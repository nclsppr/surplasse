from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

import vps_image_resolver as resolver  # noqa: E402
from vps_integration import canonical_json  # noqa: E402


REVISION = "1" * 40
INDEX_DIGEST = "sha256:" + "a" * 64
RUNTIME_DIGEST = "sha256:" + "b" * 64


def manifest() -> dict[str, object]:
    return {
        "digest": INDEX_DIGEST,
        "manifests": [
            {
                "digest": RUNTIME_DIGEST,
                "mediaType": resolver.IMAGE_MANIFEST_MEDIA_TYPE,
                "platform": {"architecture": "amd64", "os": "linux"},
                "size": 123,
            },
            {
                "annotations": {
                    "vnd.docker.reference.digest": RUNTIME_DIGEST,
                    "vnd.docker.reference.type": "attestation-manifest",
                },
                "digest": "sha256:" + "c" * 64,
                "mediaType": resolver.IMAGE_MANIFEST_MEDIA_TYPE,
                "platform": {"architecture": "unknown", "os": "unknown"},
                "size": 456,
            },
        ],
        "mediaType": resolver.IMAGE_INDEX_MEDIA_TYPE,
        "schemaVersion": 2,
        "size": 789,
    }


def image() -> dict[str, object]:
    return {
        "architecture": "amd64",
        "config": {
            "Labels": {
                "org.opencontainers.image.revision": REVISION,
                "org.opencontainers.image.source": "https://github.com/nclsppr/surplasse",
                "org.opencontainers.image.version": REVISION,
            }
        },
        "os": "linux",
    }


class ImageResolverTests(unittest.TestCase):
    def test_exact_index_and_labels_are_admitted(self) -> None:
        reference = resolver.validate_image_metadata(
            component="backend", revision=REVISION, manifest=manifest(), image=image()
        )
        self.assertEqual(
            reference,
            "ghcr.io/nclsppr/surplasse/backend@" + INDEX_DIGEST,
        )

    def test_inherited_base_image_labels_are_allowed(self) -> None:
        value = image()
        value["config"]["Labels"]["org.opencontainers.image.licenses"] = "Apache-2.0"  # type: ignore[index]
        resolver.validate_image_metadata(
            component="docs", revision=REVISION, manifest=manifest(), image=value
        )

    def test_additional_platform_is_rejected(self) -> None:
        value = manifest()
        value["manifests"].append(  # type: ignore[union-attr]
            {
                "digest": "sha256:" + "d" * 64,
                "mediaType": resolver.IMAGE_MANIFEST_MEDIA_TYPE,
                "platform": {"architecture": "arm64", "os": "linux"},
            }
        )
        with self.assertRaisesRegex(resolver.ImageResolutionError, "one linux"):
            resolver.validate_image_metadata(
                component="backend", revision=REVISION, manifest=value, image=image()
            )

    def test_wrong_source_label_is_rejected(self) -> None:
        value = image()
        value["config"]["Labels"]["org.opencontainers.image.source"] = "other"  # type: ignore[index]
        with self.assertRaisesRegex(resolver.ImageResolutionError, "labels"):
            resolver.validate_image_metadata(
                component="backend", revision=REVISION, manifest=manifest(), image=value
            )

    def test_attestation_descriptor_must_bind_runtime_digest(self) -> None:
        value = manifest()
        value["manifests"][1]["annotations"][  # type: ignore[index]
            "vnd.docker.reference.digest"
        ] = "sha256:" + "d" * 64
        with self.assertRaisesRegex(resolver.ImageResolutionError, "attestation"):
            resolver.validate_image_metadata(
                component="backend", revision=REVISION, manifest=value, image=image()
            )

    def test_empty_github_attestation_is_rejected(self) -> None:
        with self.assertRaisesRegex(resolver.ImageResolutionError, "no verified"):
            resolver.validate_attestation_output(b"[]\n")

    def test_resolver_verifies_all_five_components(self) -> None:
        calls: list[list[str]] = []

        def runner(argv: list[str]) -> bytes:
            calls.append(argv)
            if argv[0] == "gh":
                return b'[{"verificationResult":"verified"}]\n'
            if argv[-1] == "{{json .Manifest}}":
                return canonical_json(manifest())
            if argv[-1] == "{{json .Image}}":
                return canonical_json(image())
            raise AssertionError(argv)

        result = resolver.resolve_images(REVISION, runner=runner)
        self.assertEqual(len(result), 5)
        attestations = [argv for argv in calls if argv[0] == "gh"]
        self.assertEqual(len(attestations), 5)
        for argv in attestations:
            self.assertIn("--deny-self-hosted-runners", argv)
            self.assertIn(resolver.SIGNER_WORKFLOW, argv)


if __name__ == "__main__":
    unittest.main()
