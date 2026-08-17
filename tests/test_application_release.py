from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

import application_release as release  # noqa: E402
import vps_integration as integration  # noqa: E402
from tests.test_vps_integration import (  # noqa: E402
    REVISION,
    component_images,
    migrations_raw,
    probes_raw,
)


INTEGRATION_REFERENCE = integration.ARTIFACT_REPOSITORY + "@sha256:" + "f" * 64


def expected_images() -> bytes:
    return integration.expected_images_bytes(component_images(), REVISION)


def descriptor() -> bytes:
    return release.build_release(
        revision=REVISION,
        expected_images=expected_images(),
        integration_reference=INTEGRATION_REFERENCE,
        migrations=migrations_raw(),
        probes=probes_raw(),
    )


class ApplicationReleaseTests(unittest.TestCase):
    def test_descriptor_matches_shared_contract(self) -> None:
        parsed = release.validate_release(
            descriptor(),
            revision=REVISION,
            expected_images=expected_images(),
            migrations=migrations_raw(),
            probes=probes_raw(),
        )
        self.assertEqual(parsed.integration_reference, INTEGRATION_REFERENCE)
        value = json.loads(descriptor())
        self.assertEqual(
            set(value),
            {
                "schema",
                "contract",
                "application",
                "source",
                "components",
                "integration",
                "migrations",
                "probes",
            },
        )
        self.assertEqual(value["contract"], "vps-infra.application-release.v1")

    def test_unknown_top_level_field_is_rejected(self) -> None:
        value = json.loads(descriptor())
        value["checks"] = []
        with self.assertRaisesRegex(release.ApplicationReleaseError, "unexpected"):
            release.validate_release(
                integration.canonical_json(value), revision=REVISION
            )

    def test_noncanonical_descriptor_is_rejected(self) -> None:
        value = json.loads(descriptor())
        with self.assertRaisesRegex(release.ApplicationReleaseError, "canonical"):
            release.validate_release(
                json.dumps(value, indent=2).encode(), revision=REVISION
            )

    def test_mutable_component_reference_is_rejected(self) -> None:
        value = json.loads(descriptor())
        value["components"]["backend"]["image"] = (
            "ghcr.io/nclsppr/surplasse/backend:latest"
        )
        with self.assertRaisesRegex(release.ApplicationReleaseError, "immutable"):
            release.validate_release(
                integration.canonical_json(value), revision=REVISION
            )

    def test_component_source_revision_is_exact(self) -> None:
        value = json.loads(descriptor())
        value["components"]["docs"]["source_revision"] = "2" * 40
        with self.assertRaisesRegex(release.ApplicationReleaseError, "revision"):
            release.validate_release(
                integration.canonical_json(value), revision=REVISION
            )

    def test_inventory_artifact_must_equal_integration(self) -> None:
        value = json.loads(descriptor())
        value["probes"]["inventory_artifact"] = (
            integration.ARTIFACT_REPOSITORY + "@sha256:" + "e" * 64
        )
        with self.assertRaisesRegex(release.ApplicationReleaseError, "must equal"):
            release.validate_release(
                integration.canonical_json(value), revision=REVISION
            )

    def test_inventory_bytes_are_bound_by_digest(self) -> None:
        altered = json.loads(migrations_raw())
        altered["migrations"][0]["sha256"] = "b" * 64
        with self.assertRaisesRegex(release.ApplicationReleaseError, "do not match"):
            release.validate_release(
                descriptor(),
                revision=REVISION,
                migrations=integration.canonical_json(altered),
            )

    def test_manifest_binds_descriptor_and_annotations(self) -> None:
        raw_release = descriptor()
        created = "2026-08-17T12:00:00Z"
        manifest = integration.canonical_json(
            {
                "annotations": {
                    "org.opencontainers.image.created": created,
                    "org.opencontainers.image.revision": REVISION,
                    "org.opencontainers.image.source": integration.SOURCE_URL,
                },
                "artifactType": release.ARTIFACT_TYPE,
                "config": {
                    "data": "e30=",
                    "digest": release.OCI_EMPTY_CONFIG_DIGEST,
                    "mediaType": release.OCI_EMPTY_CONFIG_MEDIA_TYPE,
                    "size": 2,
                },
                "layers": [
                    {
                        "annotations": {
                            "org.opencontainers.image.title": release.RELEASE_NAME
                        },
                        "digest": integration.sha256(raw_release),
                        "mediaType": release.LAYER_MEDIA_TYPE,
                        "size": len(raw_release),
                    }
                ],
                "mediaType": release.OCI_MANIFEST_MEDIA_TYPE,
                "schemaVersion": 2,
            }
        )
        release.validate_manifest(
            manifest,
            expected_digest=integration.sha256(manifest),
            release=raw_release,
            revision=REVISION,
            created=created,
        )
        value = json.loads(manifest)
        value["artifactType"] = "application/example"
        altered = integration.canonical_json(value)
        with self.assertRaisesRegex(release.ApplicationReleaseError, "artifact type"):
            release.validate_manifest(
                altered,
                expected_digest=integration.sha256(altered),
                release=raw_release,
                revision=REVISION,
                created=created,
            )


if __name__ == "__main__":
    unittest.main()
