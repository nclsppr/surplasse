package com.surplasse.application.bootstrap;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Arrays;
import java.util.Map;
import java.util.regex.Pattern;

final class ProtectedPilotFile {

    private static final int EXPECTED_UID = 0;
    private static final int EXPECTED_GID = 10001;
    private static final int EXPECTED_MODE = 0440;

    private ProtectedPilotFile() {}

    static byte[] readManifest(Path path) {
        return read(path, PilotBootstrapManifest.MAXIMUM_BYTES, "pilot manifest");
    }

    static String readSecret(Path path, Pattern pattern, String label) {
        byte[] raw = read(path, 1024, label);
        try {
            if (!pattern.matcher(new String(raw, java.nio.charset.StandardCharsets.US_ASCII))
                    .matches()) {
                throw PilotBootstrapException.configuration("The " + label + " format is invalid.");
            }
            return new String(raw, 0, raw.length - 1, java.nio.charset.StandardCharsets.US_ASCII);
        } finally {
            Arrays.fill(raw, (byte) 0);
        }
    }

    private static byte[] read(Path path, int maximumBytes, String label) {
        try {
            Metadata before = metadata(path);
            validateMetadata(before, maximumBytes, label);
            byte[] raw = Files.readAllBytes(path);
            Metadata after = metadata(path);
            validateMetadata(after, maximumBytes, label);
            if (raw.length != before.size()
                    || !before.equals(after)
                    || raw.length == 0
                    || raw[raw.length - 1] != '\n') {
                Arrays.fill(raw, (byte) 0);
                throw PilotBootstrapException.configuration("The " + label + " changed while it was read.");
            }
            return raw;
        } catch (PilotBootstrapException exception) {
            throw exception;
        } catch (IOException | UnsupportedOperationException exception) {
            throw PilotBootstrapException.configuration("The " + label + " is missing or unreadable.");
        }
    }

    static void validateMetadata(Metadata metadata, int maximumBytes, String label) {
        if (!metadata.regularFile()
                || metadata.symbolicLink()
                || metadata.uid() != EXPECTED_UID
                || metadata.gid() != EXPECTED_GID
                || metadata.mode() != EXPECTED_MODE
                || metadata.linkCount() != 1
                || metadata.size() < 1
                || metadata.size() > maximumBytes) {
            throw PilotBootstrapException.configuration("The " + label + " has unsafe metadata.");
        }
    }

    private static Metadata metadata(Path path) throws IOException {
        BasicFileAttributes basic = Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        Map<String, Object> unix = Files.readAttributes(path, "unix:uid,gid,mode,nlink", LinkOption.NOFOLLOW_LINKS);
        return new Metadata(
                basic.isRegularFile(),
                basic.isSymbolicLink(),
                ((Number) unix.get("uid")).intValue(),
                ((Number) unix.get("gid")).intValue(),
                ((Number) unix.get("mode")).intValue() & 0777,
                ((Number) unix.get("nlink")).intValue(),
                basic.size(),
                basic.fileKey());
    }

    record Metadata(
            boolean regularFile,
            boolean symbolicLink,
            int uid,
            int gid,
            int mode,
            int linkCount,
            long size,
            Object fileKey) {}
}
