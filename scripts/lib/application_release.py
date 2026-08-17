"""Build and verify the shared Atlas application-release contract."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping

from vps_integration import (
    ARTIFACT_REPOSITORY as INTEGRATION_REPOSITORY,
    COMPONENT_REPOSITORIES,
    REVISION_RE,
    SHA256_RE,
    SOURCE_REPOSITORY,
    SOURCE_URL,
    IntegrationError,
    canonical_json,
    sha256,
    strict_json,
    validate_expected_images,
    validate_migrations,
    validate_probes,
)


CONTRACT = "vps-infra.application-release.v1"
ARTIFACT_TYPE = "application/vnd.vps-infra.application-release.v1"
LAYER_MEDIA_TYPE = "application/vnd.vps-infra.application-release.v1+json"
OCI_MANIFEST_MEDIA_TYPE = "application/vnd.oci.image.manifest.v1+json"
OCI_EMPTY_CONFIG_MEDIA_TYPE = "application/vnd.oci.empty.v1+json"
OCI_EMPTY_CONFIG_DIGEST = (
    "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
)
RELEASE_REPOSITORY = "ghcr.io/nclsppr/surplasse/application-release"
RELEASE_NAME = "application-release.json"
SIGNER_WORKFLOW = "nclsppr/surplasse/.github/workflows/vps-integration.yml"
MAX_RELEASE_SIZE = 64 * 1024
RFC3339_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")


class ApplicationReleaseError(IntegrationError):
    """Raised when the application-release descriptor is invalid."""


@dataclass(frozen=True)
class ReleaseDescriptor:
    revision: str
    components: Mapping[str, str]
    integration_reference: str
    migrations_digest: str
    probes_digest: str


def _digest_reference(value: object, repository: str, path: str) -> str:
    prefix = f"{repository}@"
    if (
        not isinstance(value, str)
        or not value.startswith(prefix)
        or SHA256_RE.fullmatch(value.removeprefix(prefix)) is None
    ):
        raise ApplicationReleaseError(
            f"{path} must be an untagged immutable {repository} reference"
        )
    return value


def build_release(
    *,
    revision: str,
    expected_images: bytes,
    integration_reference: str,
    migrations: bytes,
    probes: bytes,
) -> bytes:
    if REVISION_RE.fullmatch(revision) is None:
        raise ApplicationReleaseError("source revision is invalid")
    components = validate_expected_images(expected_images, revision)
    validate_migrations(migrations, revision)
    validate_probes(probes)
    integration = _digest_reference(
        integration_reference, INTEGRATION_REPOSITORY, "integration.artifact"
    )
    return canonical_json(
        {
            "application": "surplasse",
            "components": {
                name: {"image": components[name], "source_revision": revision}
                for name in COMPONENT_REPOSITORIES
            },
            "contract": CONTRACT,
            "integration": {
                "artifact": integration,
                "source_revision": revision,
            },
            "migrations": {
                "inventory_artifact": integration,
                "inventory_sha256": sha256(migrations),
                "runtime_auto_migrate": False,
                "strategy": "dedicated",
            },
            "probes": {
                "inventory_artifact": integration,
                "inventory_sha256": sha256(probes),
            },
            "schema": 1,
            "source": {
                "branch": "main",
                "repository": SOURCE_REPOSITORY,
                "revision": revision,
            },
        }
    )


def validate_release(
    raw: bytes,
    *,
    revision: str,
    expected_images: bytes | None = None,
    migrations: bytes | None = None,
    probes: bytes | None = None,
) -> ReleaseDescriptor:
    if REVISION_RE.fullmatch(revision) is None:
        raise ApplicationReleaseError("expected source revision is invalid")
    value = strict_json(raw, "application release", MAX_RELEASE_SIZE)
    if raw != canonical_json(value) or not isinstance(value, dict):
        raise ApplicationReleaseError("application release must be canonical JSON")
    top_keys = {
        "schema",
        "contract",
        "application",
        "source",
        "components",
        "integration",
        "migrations",
        "probes",
    }
    if set(value) != top_keys:
        raise ApplicationReleaseError("application release has unexpected fields")
    literals = {"schema": 1, "contract": CONTRACT, "application": "surplasse"}
    for key, expected in literals.items():
        if value[key] != expected or type(value[key]) is not type(expected):
            raise ApplicationReleaseError(f"application release {key} is invalid")

    source = value["source"]
    if not isinstance(source, dict) or source != {
        "branch": "main",
        "repository": SOURCE_REPOSITORY,
        "revision": revision,
    }:
        raise ApplicationReleaseError("application release source is invalid")

    component_values = value["components"]
    if not isinstance(component_values, dict) or set(component_values) != set(
        COMPONENT_REPOSITORIES
    ):
        raise ApplicationReleaseError(
            "application release component allowlist is invalid"
        )
    components: dict[str, str] = {}
    for name, repository in COMPONENT_REPOSITORIES.items():
        component = component_values[name]
        if not isinstance(component, dict) or set(component) != {
            "image",
            "source_revision",
        }:
            raise ApplicationReleaseError(f"component {name} fields are invalid")
        if component["source_revision"] != revision:
            raise ApplicationReleaseError(f"component {name} revision is invalid")
        components[name] = _digest_reference(
            component["image"], repository, f"components.{name}.image"
        )

    integration = value["integration"]
    if not isinstance(integration, dict) or set(integration) != {
        "artifact",
        "source_revision",
    }:
        raise ApplicationReleaseError(
            "application release integration fields are invalid"
        )
    if integration["source_revision"] != revision:
        raise ApplicationReleaseError(
            "application release integration revision is invalid"
        )
    integration_reference = _digest_reference(
        integration["artifact"], INTEGRATION_REPOSITORY, "integration.artifact"
    )

    migration = value["migrations"]
    if not isinstance(migration, dict) or set(migration) != {
        "inventory_artifact",
        "inventory_sha256",
        "runtime_auto_migrate",
        "strategy",
    }:
        raise ApplicationReleaseError(
            "application release migrations fields are invalid"
        )
    if (
        migration["strategy"] != "dedicated"
        or migration["runtime_auto_migrate"] is not False
    ):
        raise ApplicationReleaseError("application release migration policy is invalid")
    if migration["inventory_artifact"] != integration_reference:
        raise ApplicationReleaseError(
            "migration inventory artifact must equal integration"
        )
    migrations_digest = migration["inventory_sha256"]
    if (
        not isinstance(migrations_digest, str)
        or SHA256_RE.fullmatch(migrations_digest) is None
    ):
        raise ApplicationReleaseError("migration inventory digest is invalid")

    probe = value["probes"]
    if not isinstance(probe, dict) or set(probe) != {
        "inventory_artifact",
        "inventory_sha256",
    }:
        raise ApplicationReleaseError("application release probes fields are invalid")
    if probe["inventory_artifact"] != integration_reference:
        raise ApplicationReleaseError("probe inventory artifact must equal integration")
    probes_digest = probe["inventory_sha256"]
    if not isinstance(probes_digest, str) or SHA256_RE.fullmatch(probes_digest) is None:
        raise ApplicationReleaseError("probe inventory digest is invalid")

    if expected_images is not None:
        expected_components = validate_expected_images(expected_images, revision)
        if components != expected_components:
            raise ApplicationReleaseError(
                "component images diverge from their inventory"
            )
    if migrations is not None:
        validate_migrations(migrations, revision)
        if migrations_digest != sha256(migrations):
            raise ApplicationReleaseError(
                "migration inventory bytes do not match release"
            )
    if probes is not None:
        validate_probes(probes)
        if probes_digest != sha256(probes):
            raise ApplicationReleaseError("probe inventory bytes do not match release")
    return ReleaseDescriptor(
        revision=revision,
        components=components,
        integration_reference=integration_reference,
        migrations_digest=migrations_digest,
        probes_digest=probes_digest,
    )


def validate_manifest(
    raw: bytes,
    *,
    expected_digest: str,
    release: bytes,
    revision: str,
    created: str,
) -> None:
    if SHA256_RE.fullmatch(expected_digest) is None or sha256(raw) != expected_digest:
        raise ApplicationReleaseError("release manifest bytes do not match its digest")
    manifest = strict_json(raw, "application release OCI manifest", MAX_RELEASE_SIZE)
    if not isinstance(manifest, dict) or set(manifest) != {
        "annotations",
        "artifactType",
        "config",
        "layers",
        "mediaType",
        "schemaVersion",
    }:
        raise ApplicationReleaseError("release manifest has unexpected fields")
    if (
        manifest["schemaVersion"] != 2
        or manifest["mediaType"] != OCI_MANIFEST_MEDIA_TYPE
    ):
        raise ApplicationReleaseError("release manifest identity is invalid")
    if manifest["artifactType"] != ARTIFACT_TYPE:
        raise ApplicationReleaseError("release manifest artifact type is invalid")
    if manifest["config"] != {
        "data": "e30=",
        "digest": OCI_EMPTY_CONFIG_DIGEST,
        "mediaType": OCI_EMPTY_CONFIG_MEDIA_TYPE,
        "size": 2,
    }:
        raise ApplicationReleaseError("release manifest empty config is invalid")
    if not isinstance(created, str) or RFC3339_RE.fullmatch(created) is None:
        raise ApplicationReleaseError("release creation time is invalid")
    if manifest["annotations"] != {
        "org.opencontainers.image.created": created,
        "org.opencontainers.image.revision": revision,
        "org.opencontainers.image.source": SOURCE_URL,
    }:
        raise ApplicationReleaseError("release manifest annotations are invalid")
    if manifest["layers"] != [
        {
            "annotations": {"org.opencontainers.image.title": RELEASE_NAME},
            "digest": sha256(release),
            "mediaType": LAYER_MEDIA_TYPE,
            "size": len(release),
        }
    ]:
        raise ApplicationReleaseError("release manifest layer is invalid")


def evidence_bytes(
    *,
    artifact_reference: str,
    release: bytes,
    revision: str,
    created: str,
    run_id: int,
    run_attempt: int,
) -> bytes:
    _digest_reference(artifact_reference, RELEASE_REPOSITORY, "evidence artifact")
    if REVISION_RE.fullmatch(revision) is None or RFC3339_RE.fullmatch(created) is None:
        raise ApplicationReleaseError("evidence source identity is invalid")
    if (
        type(run_id) is not int
        or run_id < 1
        or type(run_attempt) is not int
        or run_attempt < 1
    ):
        raise ApplicationReleaseError("evidence run identity is invalid")
    return canonical_json(
        {
            "artifact": artifact_reference,
            "artifact_type": ARTIFACT_TYPE,
            "created": created,
            "descriptor": {
                "media_type": LAYER_MEDIA_TYPE,
                "sha256": sha256(release),
                "size": len(release),
                "title": RELEASE_NAME,
            },
            "run_attempt": run_attempt,
            "run_id": run_id,
            "schema": 1,
            "signer_workflow": SIGNER_WORKFLOW,
            "source": SOURCE_URL,
            "source_revision": revision,
            "verified_gates": [
                "canonical-content",
                "component-provenance",
                "github-provenance",
                "integration-provenance",
                "oci-annotations",
                "published-manifest-digest",
                "registry-round-trip",
                "same-revision-gates",
            ],
        }
    )
