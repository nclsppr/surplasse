package com.surplasse.application.bootstrap;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ProtectedPilotFileTest {

    @Test
    void validateMetadata_exactRootOwnedContract_acceptsFile() {
        var metadata = new ProtectedPilotFile.Metadata(true, false, 0, 10001, 0440, 1, 100, "file-key");

        assertDoesNotThrow(() -> ProtectedPilotFile.validateMetadata(metadata, 1024, "fixture"));
    }

    @Test
    void validateMetadata_groupWritableFile_failsClosed() {
        var metadata = new ProtectedPilotFile.Metadata(true, false, 0, 10001, 0460, 1, 100, "file-key");

        assertThrows(
                PilotBootstrapException.class, () -> ProtectedPilotFile.validateMetadata(metadata, 1024, "fixture"));
    }

    @Test
    void validateMetadata_nonRootOwner_failsClosed() {
        var metadata = new ProtectedPilotFile.Metadata(true, false, 10001, 10001, 0440, 1, 100, "file-key");

        assertThrows(
                PilotBootstrapException.class, () -> ProtectedPilotFile.validateMetadata(metadata, 1024, "fixture"));
    }
}
