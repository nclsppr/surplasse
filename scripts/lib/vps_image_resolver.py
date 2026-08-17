"""Resolve and strictly verify the five Surplasse application images."""

from __future__ import annotations

import subprocess
from typing import Any, Callable, Mapping

from vps_integration import (
    COMPONENT_REPOSITORIES,
    REVISION_RE,
    SHA256_RE,
    SOURCE_REPOSITORY,
    SOURCE_URL,
    IntegrationError,
    canonical_json,
    strict_json,
)


IMAGE_INDEX_MEDIA_TYPE = "application/vnd.oci.image.index.v1+json"
IMAGE_MANIFEST_MEDIA_TYPE = "application/vnd.oci.image.manifest.v1+json"
SIGNER_WORKFLOW = "nclsppr/surplasse/.github/workflows/images.yml"


class ImageResolutionError(IntegrationError):
    """Raised when one image tag is not the exact admissible build."""


def _run(argv: list[str]) -> bytes:
    try:
        completed = subprocess.run(
            argv,
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError as exc:
        raise ImageResolutionError(f"cannot execute {argv[0]}: {exc}") from exc
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ImageResolutionError(
            f"{argv[0]} failed with code {completed.returncode}: {detail}"
        )
    if len(completed.stdout) > 10 * 1024 * 1024:
        raise ImageResolutionError(f"{argv[0]} output exceeds the safety limit")
    return completed.stdout


def validate_image_metadata(
    *, component: str, revision: str, manifest: object, image: object
) -> str:
    if component not in COMPONENT_REPOSITORIES:
        raise ImageResolutionError("image component is outside the allowlist")
    if REVISION_RE.fullmatch(revision) is None:
        raise ImageResolutionError("image revision is invalid")
    if not isinstance(manifest, dict):
        raise ImageResolutionError("image index must be an object")
    if (
        manifest.get("schemaVersion") != 2
        or manifest.get("mediaType") != IMAGE_INDEX_MEDIA_TYPE
    ):
        raise ImageResolutionError("image must use an OCI index")
    digest = manifest.get("digest")
    if not isinstance(digest, str) or SHA256_RE.fullmatch(digest) is None:
        raise ImageResolutionError("image index digest is invalid")
    descriptors = manifest.get("manifests")
    if not isinstance(descriptors, list) or len(descriptors) != 2:
        raise ImageResolutionError(
            "image index must contain one linux/amd64 image and one attestation"
        )
    runtime: list[dict[str, Any]] = []
    attestations: list[dict[str, Any]] = []
    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            raise ImageResolutionError("image descriptor must be an object")
        if descriptor.get("mediaType") != IMAGE_MANIFEST_MEDIA_TYPE:
            raise ImageResolutionError("image descriptor media type is invalid")
        platform = descriptor.get("platform")
        if not isinstance(platform, dict):
            raise ImageResolutionError("image descriptor platform is missing")
        if platform == {"architecture": "amd64", "os": "linux"}:
            runtime.append(descriptor)
        elif platform == {"architecture": "unknown", "os": "unknown"}:
            attestations.append(descriptor)
        else:
            raise ImageResolutionError("image index contains an unsupported platform")
    if len(runtime) != 1 or len(attestations) != 1:
        raise ImageResolutionError("image platform cardinality is invalid")
    runtime_digest = runtime[0].get("digest")
    if (
        not isinstance(runtime_digest, str)
        or SHA256_RE.fullmatch(runtime_digest) is None
    ):
        raise ImageResolutionError("runtime image digest is invalid")
    if attestations[0].get("annotations") != {
        "vnd.docker.reference.digest": runtime_digest,
        "vnd.docker.reference.type": "attestation-manifest",
    }:
        raise ImageResolutionError("image attestation descriptor is invalid")
    if (
        not isinstance(image, dict)
        or image.get("os") != "linux"
        or image.get("architecture") != "amd64"
    ):
        raise ImageResolutionError("resolved runtime image is not linux/amd64")
    config = image.get("config")
    labels = config.get("Labels") if isinstance(config, dict) else None
    required_labels = {
        "org.opencontainers.image.revision": revision,
        "org.opencontainers.image.source": SOURCE_URL,
        "org.opencontainers.image.version": revision,
    }
    if not isinstance(labels, dict) or any(
        labels.get(key) != expected for key, expected in required_labels.items()
    ):
        raise ImageResolutionError(
            f"{component} image OCI labels do not bind the exact source revision"
        )
    return f"{COMPONENT_REPOSITORIES[component]}@{digest}"


def validate_attestation_output(raw: bytes) -> None:
    value = strict_json(raw, "GitHub image attestation output", 10 * 1024 * 1024)
    if not isinstance(value, list) or not value:
        raise ImageResolutionError("GitHub returned no verified image attestation")


def resolve_images(
    revision: str,
    *,
    runner: Callable[[list[str]], bytes] = _run,
) -> dict[str, str]:
    if REVISION_RE.fullmatch(revision) is None:
        raise ImageResolutionError("image revision must be a full lowercase Git SHA")
    result: dict[str, str] = {}
    for component, repository in COMPONENT_REPOSITORIES.items():
        tag = f"{repository}:{revision}"
        manifest = strict_json(
            runner(
                [
                    "docker",
                    "buildx",
                    "imagetools",
                    "inspect",
                    tag,
                    "--format",
                    "{{json .Manifest}}",
                ]
            ),
            f"{component} image index",
            10 * 1024 * 1024,
        )
        image = strict_json(
            runner(
                [
                    "docker",
                    "buildx",
                    "imagetools",
                    "inspect",
                    tag,
                    "--format",
                    "{{json .Image}}",
                ]
            ),
            f"{component} image config",
            10 * 1024 * 1024,
        )
        reference = validate_image_metadata(
            component=component,
            revision=revision,
            manifest=manifest,
            image=image,
        )
        attestation = runner(
            [
                "gh",
                "attestation",
                "verify",
                f"oci://{reference}",
                "--repo",
                SOURCE_REPOSITORY,
                "--source-digest",
                revision,
                "--source-ref",
                "refs/heads/main",
                "--signer-workflow",
                SIGNER_WORKFLOW,
                "--deny-self-hosted-runners",
                "--format",
                "json",
            ]
        )
        validate_attestation_output(attestation)
        result[component] = reference
    return result


def resolved_images_bytes(images: Mapping[str, str]) -> bytes:
    if set(images) != set(COMPONENT_REPOSITORIES):
        raise ImageResolutionError("resolved image map does not match the allowlist")
    return canonical_json(dict(images))
