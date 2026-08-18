"""Build and verify the secret-free Surplasse VPS integration artifact."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import re
import subprocess
import tarfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any, Mapping


ARTIFACT_TYPE = "application/vnd.vps-infra.application-integration.v1"
ARCHIVE_MEDIA_TYPE = "application/vnd.vps-infra.application-integration.v1+tar+gzip"
INVENTORY_MEDIA_TYPE = (
    "application/vnd.vps-infra.application-integration.inventory.v1+json"
)
OCI_MANIFEST_MEDIA_TYPE = "application/vnd.oci.image.manifest.v1+json"
OCI_EMPTY_CONFIG_MEDIA_TYPE = "application/vnd.oci.empty.v1+json"
OCI_EMPTY_CONFIG_DIGEST = (
    "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
)
SOURCE_REPOSITORY = "nclsppr/surplasse"
SOURCE_URL = f"https://github.com/{SOURCE_REPOSITORY}"
ARTIFACT_REPOSITORY = "ghcr.io/nclsppr/surplasse/vps-integration"
SIGNER_WORKFLOW = "nclsppr/surplasse/.github/workflows/vps-integration.yml"
ARCHIVE_NAME = "integration.tar.gz"
INVENTORY_NAME = "inventory.json"
MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_TOTAL_SIZE = 25 * 1024 * 1024
MAX_ARCHIVE_SIZE = 10 * 1024 * 1024
MAX_TAR_SIZE = MAX_TOTAL_SIZE + (1024 * 1024)
SHA256_RE = re.compile(r"sha256:[0-9a-f]{64}")
HEX_SHA256_RE = re.compile(r"[0-9a-f]{64}")
REVISION_RE = re.compile(r"[0-9a-f]{40}")
MIGRATION_RE = re.compile(r"V([1-9][0-9]*)__([A-Za-z0-9_]+)\.sql")
ATLAS_TLS_IMPORT = "import /etc/caddy/surplasse-tls.caddy"

STATIC_FILES: Mapping[str, str] = {
    "caddy/surplasse.caddy": "deployment/vps/caddy/surplasse.caddy",
    "compose.yaml": "deployment/vps/compose.yaml",
    "grafana/dashboards/surplasse-overview.json": (
        "infra/observability/grafana/dashboards/surplasse-overview.json"
    ),
    "prometheus/rules.yml": ("deployment/vps/prometheus/rules/surplasse.yml"),
    "prometheus/targets.yml": ("deployment/vps/prometheus/targets/surplasse.yml"),
}
RUNTIME_PATHS = tuple(
    sorted(
        (
            *STATIC_FILES,
            "contract.json",
            "expected-images.json",
            "migrations.json",
            "probes.json",
        )
    )
)
DIRECTORY_PATHS = tuple(
    sorted(
        {
            "integration",
            *(
                f"integration/{parent}"
                for path in RUNTIME_PATHS
                for parent in (
                    PurePosixPath(path).parent.as_posix(),
                    *(
                        ancestor.as_posix()
                        for ancestor in PurePosixPath(path).parents
                        if ancestor.as_posix() not in {".", ""}
                    ),
                )
                if parent not in {".", ""}
            ),
        },
        key=lambda path: (len(PurePosixPath(path).parts), path),
    )
)
COMPONENT_REPOSITORIES: Mapping[str, str] = {
    "backend": "ghcr.io/nclsppr/surplasse/backend",
    "onboarding": "ghcr.io/nclsppr/surplasse/onboarding",
    "commande": "ghcr.io/nclsppr/surplasse/commande",
    "dashboard": "ghcr.io/nclsppr/surplasse/dashboard",
    "docs": "ghcr.io/nclsppr/surplasse/docs",
}
MIGRATION_ROOTS = (
    "backend/catalog/src/main/resources/db/migration",
    "backend/identity/src/main/resources/db/migration",
    "backend/order/src/main/resources/db/migration",
    "backend/payment/src/main/resources/db/migration",
)


class IntegrationError(ValueError):
    """Raised when an immutable integration contract is invalid."""


@dataclass(frozen=True)
class RuntimeFile:
    path: str
    content: bytes
    mode: int = 0o644

    @property
    def digest(self) -> str:
        return sha256(self.content)


@dataclass(frozen=True)
class Package:
    revision: str
    created: str
    archive: bytes
    inventory: bytes


def _command(argv: list[str], *, cwd: Path) -> bytes:
    try:
        completed = subprocess.run(
            argv,
            cwd=cwd,
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError as exc:
        raise IntegrationError(f"cannot execute {argv[0]}: {exc}") from exc
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise IntegrationError(
            f"{argv[0]} failed with code {completed.returncode}: {detail}"
        )
    if len(completed.stdout) > MAX_TOTAL_SIZE:
        raise IntegrationError(f"{argv[0]} output exceeds the safety limit")
    return completed.stdout


def _reject_constant(value: str) -> None:
    raise IntegrationError(f"JSON constant {value!r} is not permitted")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise IntegrationError(f"JSON contains duplicate key {key!r}")
        result[key] = value
    return result


def strict_json(data: bytes, subject: str, maximum: int = MAX_FILE_SIZE) -> object:
    if not 1 <= len(data) <= maximum:
        raise IntegrationError(f"{subject} exceeds its size limit")
    try:
        return json.loads(
            data.decode("utf-8", errors="strict"),
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as exc:
        raise IntegrationError(f"{subject} is not strict UTF-8 JSON") from exc


def canonical_json(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def sha256(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def _revision_and_epoch(repository: Path, revision: str) -> tuple[str, int]:
    if REVISION_RE.fullmatch(revision) is None:
        raise IntegrationError("source revision must be a full lowercase Git commit ID")
    resolved = (
        _command(
            ["git", "rev-parse", "--verify", f"{revision}^{{commit}}"], cwd=repository
        )
        .decode("ascii", errors="strict")
        .strip()
    )
    if resolved != revision:
        raise IntegrationError("source revision did not resolve to itself")
    raw_epoch = (
        _command(["git", "show", "-s", "--format=%ct", revision], cwd=repository)
        .decode("ascii", errors="strict")
        .strip()
    )
    try:
        epoch = int(raw_epoch)
    except ValueError as exc:
        raise IntegrationError("source commit timestamp is invalid") from exc
    if not 0 <= epoch <= 0xFFFFFFFF:
        raise IntegrationError("source commit timestamp is outside the gzip range")
    return resolved, epoch


def created_from_epoch(epoch: int) -> str:
    return (
        datetime.fromtimestamp(epoch, tz=UTC)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def epoch_from_created(created: object) -> int:
    if not isinstance(created, str) or not created.endswith("Z"):
        raise IntegrationError("created must be a canonical UTC RFC 3339 timestamp")
    try:
        parsed = datetime.fromisoformat(created.removesuffix("Z") + "+00:00")
    except ValueError as exc:
        raise IntegrationError(
            "created must be a canonical UTC RFC 3339 timestamp"
        ) from exc
    canonical = parsed.isoformat(timespec="seconds").replace("+00:00", "Z")
    if parsed.microsecond != 0 or canonical != created:
        raise IntegrationError("created timestamp is not canonical")
    epoch = int(parsed.timestamp())
    if not 0 <= epoch <= 0xFFFFFFFF:
        raise IntegrationError("created timestamp is outside the gzip range")
    return epoch


def _git_blob(repository: Path, revision: str, path: str) -> bytes:
    tree = _command(["git", "ls-tree", "-z", revision, "--", path], cwd=repository)
    records = [record for record in tree.split(b"\0") if record]
    if len(records) != 1:
        raise IntegrationError(f"tracked runtime file is missing or ambiguous: {path}")
    try:
        metadata, raw_path = records[0].split(b"\t", maxsplit=1)
        mode, object_type, object_id = metadata.decode("ascii").split(" ")
        actual_path = raw_path.decode("utf-8", errors="strict")
    except (UnicodeDecodeError, ValueError) as exc:
        raise IntegrationError(f"Git returned an invalid entry for {path}") from exc
    if actual_path != path or mode != "100644" or object_type != "blob":
        raise IntegrationError(f"unsafe tracked runtime file type or mode: {path}")
    content = _command(["git", "cat-file", "blob", object_id], cwd=repository)
    _validate_text(content, path)
    return content


def _validate_text(content: bytes, path: str) -> None:
    if len(content) > MAX_FILE_SIZE:
        raise IntegrationError(f"runtime file exceeds the size limit: {path}")
    if b"\0" in content:
        raise IntegrationError(f"runtime file contains a NUL byte: {path}")
    try:
        content.decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise IntegrationError(f"runtime file is not UTF-8 text: {path}") from exc


def validate_component_images(value: object, revision: str) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != set(COMPONENT_REPOSITORIES):
        raise IntegrationError("component image map must match the exact allowlist")
    result: dict[str, str] = {}
    for component, repository in COMPONENT_REPOSITORIES.items():
        reference = value[component]
        prefix = f"{repository}@"
        if (
            not isinstance(reference, str)
            or not reference.startswith(prefix)
            or SHA256_RE.fullmatch(reference.removeprefix(prefix)) is None
        ):
            raise IntegrationError(
                f"component image {component} must be an immutable {repository} reference"
            )
        result[component] = reference
    if REVISION_RE.fullmatch(revision) is None:
        raise IntegrationError("component image revision is invalid")
    return result


def expected_images_bytes(images: object, revision: str) -> bytes:
    components = validate_component_images(images, revision)
    services = {**components, "migrator": components["backend"]}
    return canonical_json(
        {"images": services, "schema": 1, "source_revision": revision}
    )


def validate_expected_images(raw: bytes, revision: str) -> dict[str, str]:
    value = strict_json(raw, "expected image inventory")
    if raw != canonical_json(value) or not isinstance(value, dict):
        raise IntegrationError("expected image inventory must be canonical JSON")
    if set(value) != {"images", "schema", "source_revision"}:
        raise IntegrationError("expected image inventory has unexpected fields")
    if value["schema"] != 1 or isinstance(value["schema"], bool):
        raise IntegrationError("expected image inventory schema is invalid")
    if value["source_revision"] != revision:
        raise IntegrationError("expected image inventory revision is invalid")
    images = value["images"]
    if not isinstance(images, dict):
        raise IntegrationError("expected image inventory images must be an object")
    if set(images) != {*COMPONENT_REPOSITORIES, "migrator"}:
        raise IntegrationError(
            "expected image service map must match the exact allowlist"
        )
    components = validate_component_images(
        {name: images[name] for name in COMPONENT_REPOSITORIES}, revision
    )
    if images["migrator"] != components["backend"]:
        raise IntegrationError("migrator must use the exact backend image")
    return components


def contract_bytes(revision: str) -> bytes:
    if REVISION_RE.fullmatch(revision) is None:
        raise IntegrationError("integration contract revision is invalid")
    return canonical_json(
        {
            "application": "surplasse",
            "compose_file": "compose.yaml",
            "compose_project": "surplasse",
            "contract": "surplasse.vps-integration",
            "image_variables": {
                "backend": "SURPLASSE_BACKEND_IMAGE",
                "commande": "SURPLASSE_COMMANDE_IMAGE",
                "dashboard": "SURPLASSE_DASHBOARD_IMAGE",
                "docs": "SURPLASSE_DOCS_IMAGE",
                "onboarding": "SURPLASSE_ONBOARDING_IMAGE",
            },
            "migration": {
                "entrypoint": "/opt/surplasse/scripts/backend-migrate.sh",
                "published_in_backend_image": True,
                "runtime_auto_migrate": False,
            },
            "networks": ["app_surplasse", "db_surplasse"],
            "public_hosts": [
                "surplasse.com",
                "www.surplasse.com",
                "api.surplasse.com",
                "dashboard.surplasse.com",
                "docs.surplasse.com",
                "*.surplasse.com",
            ],
            "route_owner": "compose",
            "runtime_services": [
                "backend",
                "commande",
                "dashboard",
                "docs",
                "onboarding",
            ],
            "schema": 1,
            "secrets": [
                "surplasse-jwt-jwks",
                "surplasse-jwt-private-key",
                "surplasse-postgres-migrator-password",
                "surplasse-postgres-runtime-password",
                "surplasse-smtp-password",
                "surplasse-smtp-username",
                "surplasse-stripe-account-webhook-secret",
                "surplasse-stripe-payment-webhook-secret",
                "surplasse-stripe-secret-key",
            ],
            "source_repository": SOURCE_REPOSITORY,
            "source_revision": revision,
            "transient_services": ["migrator"],
        }
    )


def validate_contract(raw: bytes, revision: str) -> None:
    value = strict_json(raw, "integration contract")
    if raw != canonical_json(value) or raw != contract_bytes(revision):
        raise IntegrationError(
            "integration contract differs from the exact canonical policy"
        )


def validate_caddy_route(raw: bytes) -> None:
    _validate_text(raw, "caddy/surplasse.caddy")
    route = raw.decode("utf-8", errors="strict")
    lines = [line.strip() for line in route.splitlines()]
    if lines.count(ATLAS_TLS_IMPORT) != 1:
        raise IntegrationError(
            "Caddy route must import the exact Atlas-owned TLS policy once"
        )
    if re.search(r"(?m)^\s*tls(?:\s|\{)", route) is not None:
        raise IntegrationError("Caddy route must not own its TLS policy")
    if re.search(r"(?m)^\s*dns(?:\s|\{)", route) is not None:
        raise IntegrationError("Caddy route must not select a DNS provider")


def _migration_entries(repository: Path, revision: str) -> list[dict[str, object]]:
    tree = _command(
        ["git", "ls-tree", "-r", "-z", "--full-tree", revision, "--", *MIGRATION_ROOTS],
        cwd=repository,
    )
    migrations: list[tuple[int, str, bytes]] = []
    for record in tree.split(b"\0"):
        if not record:
            continue
        try:
            metadata, raw_path = record.split(b"\t", maxsplit=1)
            mode, object_type, object_id = metadata.decode("ascii").split(" ")
            path = raw_path.decode("utf-8", errors="strict")
        except (UnicodeDecodeError, ValueError) as exc:
            raise IntegrationError("Git returned an invalid migration entry") from exc
        name = PurePosixPath(path).name
        match = MIGRATION_RE.fullmatch(name)
        if match is None:
            raise IntegrationError(f"unexpected file in migration roots: {path}")
        if mode != "100644" or object_type != "blob":
            raise IntegrationError(f"unsafe migration file type or mode: {path}")
        content = _command(["git", "cat-file", "blob", object_id], cwd=repository)
        _validate_text(content, path)
        migrations.append((int(match.group(1)), path, content))
    migrations.sort(key=lambda item: (item[0], item[1]))
    versions = [item[0] for item in migrations]
    if not versions or versions != list(range(1, len(versions) + 1)):
        raise IntegrationError(
            "migration versions must be unique and contiguous from V1"
        )
    return [
        {
            "path": path,
            "sha256": hashlib.sha256(content).hexdigest(),
            "version": version,
        }
        for version, path, content in migrations
    ]


def migrations_bytes(repository: Path, revision: str) -> bytes:
    return canonical_json(
        {
            "contract": "surplasse.flyway-migrations",
            "database": "surplasse",
            "migrations": _migration_entries(repository, revision),
            "runner": "/opt/surplasse/scripts/backend-migrate.sh",
            "runtime_auto_migrate": False,
            "schema": 1,
            "source_repository": SOURCE_REPOSITORY,
            "source_revision": revision,
        }
    )


def validate_migrations(raw: bytes, revision: str) -> None:
    value = strict_json(raw, "migration inventory")
    if raw != canonical_json(value) or not isinstance(value, dict):
        raise IntegrationError("migration inventory must be canonical JSON")
    expected = {
        "contract",
        "database",
        "migrations",
        "runner",
        "runtime_auto_migrate",
        "schema",
        "source_repository",
        "source_revision",
    }
    if set(value) != expected:
        raise IntegrationError("migration inventory has unexpected fields")
    literals = {
        "contract": "surplasse.flyway-migrations",
        "database": "surplasse",
        "runner": "/opt/surplasse/scripts/backend-migrate.sh",
        "runtime_auto_migrate": False,
        "schema": 1,
        "source_repository": SOURCE_REPOSITORY,
        "source_revision": revision,
    }
    for key, expected_value in literals.items():
        if value[key] != expected_value or type(value[key]) is not type(expected_value):
            raise IntegrationError(f"migration inventory {key} is invalid")
    entries = value["migrations"]
    if not isinstance(entries, list) or not entries:
        raise IntegrationError("migration inventory must contain migrations")
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict) or set(entry) != {"path", "sha256", "version"}:
            raise IntegrationError("migration inventory entry is invalid")
        if entry["version"] != index or isinstance(entry["version"], bool):
            raise IntegrationError("migration versions must be contiguous from V1")
        if (
            not isinstance(entry["path"], str)
            or MIGRATION_RE.fullmatch(PurePosixPath(entry["path"]).name) is None
        ):
            raise IntegrationError("migration inventory path is invalid")
        if (
            not isinstance(entry["sha256"], str)
            or HEX_SHA256_RE.fullmatch(entry["sha256"]) is None
        ):
            raise IntegrationError("migration inventory digest is invalid")


def probes_bytes(repository: Path, revision: str) -> bytes:
    raw = _git_blob(repository, revision, "deployment/vps/probes.json")
    value = strict_json(raw, "probe inventory")
    return canonical_json(value)


def validate_probes(raw: bytes) -> None:
    value = strict_json(raw, "probe inventory")
    if raw != canonical_json(value) or not isinstance(value, dict):
        raise IntegrationError("probe inventory must be canonical JSON")
    if set(value) != {"contract", "internal", "public", "schema"}:
        raise IntegrationError("probe inventory has unexpected fields")
    if value["contract"] != "surplasse.probes" or value["schema"] != 1:
        raise IntegrationError("probe inventory identity is invalid")
    internal = value["internal"]
    public = value["public"]
    if not isinstance(internal, list) or not isinstance(public, list):
        raise IntegrationError("probe inventories must be arrays")
    services: set[str] = set()
    for probe in internal:
        if not isinstance(probe, dict):
            raise IntegrationError("internal probe entry must be an object")
        required = {"service", "status", "url"}
        if not required.issubset(probe) or set(probe) - (required | {"body_contains"}):
            raise IntegrationError("internal probe entry fields are invalid")
        service = probe["service"]
        if not isinstance(service, str) or service in services:
            raise IntegrationError("internal probe services must be unique strings")
        services.add(service)
        if not isinstance(probe["url"], str) or not probe["url"].startswith("http://"):
            raise IntegrationError("internal probe URL is invalid")
        _validate_probe_status_and_body(probe)
    if services != set(COMPONENT_REPOSITORIES):
        raise IntegrationError("internal probes must cover every runtime service")
    identities: set[tuple[str, str]] = set()
    for probe in public:
        if not isinstance(probe, dict):
            raise IntegrationError("public probe entry must be an object")
        required = {"host", "path", "status"}
        if not required.issubset(probe) or set(probe) - (required | {"body_contains"}):
            raise IntegrationError("public probe entry fields are invalid")
        host = probe["host"]
        path = probe["path"]
        if (
            not isinstance(host, str)
            or (not host.endswith(".surplasse.com") and host != "surplasse.com")
            or not isinstance(path, str)
            or not path.startswith("/")
        ):
            raise IntegrationError("public probe endpoint is invalid")
        identity = (host, path)
        if identity in identities:
            raise IntegrationError("public probe endpoints must be unique")
        identities.add(identity)
        _validate_probe_status_and_body(probe)
    required_public = {
        ("surplasse.com", "/.well-known/surplasse-edge"),
        ("surplasse.com", "/"),
        ("dashboard.surplasse.com", "/"),
        ("docs.surplasse.com", "/"),
        ("probe.surplasse.com", "/"),
        ("api.surplasse.com", "/q/health/ready"),
    }
    if identities != required_public:
        raise IntegrationError("public probes differ from the exact endpoint allowlist")


def _validate_probe_status_and_body(probe: Mapping[str, object]) -> None:
    if type(probe["status"]) is not int or not 100 <= int(probe["status"]) <= 599:
        raise IntegrationError("probe status is invalid")
    if "body_contains" in probe and (
        not isinstance(probe["body_contains"], str) or not probe["body_contains"]
    ):
        raise IntegrationError("probe body requirement is invalid")


def load_runtime_files(
    repository: Path, revision: str, component_images: object
) -> tuple[list[RuntimeFile], int]:
    repository = repository.resolve()
    _, epoch = _revision_and_epoch(repository, revision)
    generated = {
        "contract.json": contract_bytes(revision),
        "expected-images.json": expected_images_bytes(component_images, revision),
        "migrations.json": migrations_bytes(repository, revision),
        "probes.json": probes_bytes(repository, revision),
    }
    contents = {
        output: _git_blob(repository, revision, source)
        for output, source in STATIC_FILES.items()
    }
    contents.update(generated)
    if tuple(sorted(contents)) != RUNTIME_PATHS:
        raise IntegrationError("runtime path construction diverged from the allowlist")
    validate_caddy_route(contents["caddy/surplasse.caddy"])
    files = [RuntimeFile(path=path, content=contents[path]) for path in RUNTIME_PATHS]
    if sum(len(item.content) for item in files) > MAX_TOTAL_SIZE:
        raise IntegrationError("runtime files exceed the total size limit")
    return files, epoch


def inventory_for(runtime_files: list[RuntimeFile], *, revision: str) -> dict[str, Any]:
    return {
        "contract": "vps-infra.application-integration.v1",
        "files": [
            {
                "bytes": len(item.content),
                "path": item.path,
                "sha256": hashlib.sha256(item.content).hexdigest(),
            }
            for item in runtime_files
        ],
        "schema": 1,
        "source": {"repository": SOURCE_REPOSITORY, "revision": revision},
    }


def archive_for(runtime_files: list[RuntimeFile], *, epoch: int) -> bytes:
    if epoch != 0:
        raise IntegrationError("integration archive timestamp must be zero")
    tar_buffer = io.BytesIO()
    with tarfile.open(
        fileobj=tar_buffer, mode="w", format=tarfile.USTAR_FORMAT
    ) as archive:
        for path in DIRECTORY_PATHS:
            entry = tarfile.TarInfo(name=path)
            entry.type = tarfile.DIRTYPE
            entry.mode = 0o755
            entry.uid = 0
            entry.gid = 0
            entry.uname = ""
            entry.gname = ""
            entry.mtime = 0
            archive.addfile(entry)
        for item in runtime_files:
            entry = tarfile.TarInfo(name=f"integration/{item.path}")
            entry.type = tarfile.REGTYPE
            entry.mode = item.mode
            entry.uid = 0
            entry.gid = 0
            entry.uname = ""
            entry.gname = ""
            entry.mtime = 0
            entry.size = len(item.content)
            archive.addfile(entry, io.BytesIO(item.content))
    compressed = io.BytesIO()
    with gzip.GzipFile(
        filename="", mode="wb", compresslevel=9, fileobj=compressed, mtime=0
    ) as output:
        output.write(tar_buffer.getvalue())
    result = compressed.getvalue()
    if len(result) > MAX_ARCHIVE_SIZE:
        raise IntegrationError("VPS integration archive exceeds the size limit")
    return result


def build_package(repository: Path, revision: str, component_images: object) -> Package:
    files, epoch = load_runtime_files(repository, revision, component_images)
    created = created_from_epoch(epoch)
    return Package(
        revision=revision,
        created=created,
        archive=archive_for(files, epoch=0),
        inventory=canonical_json(inventory_for(files, revision=revision)),
    )


def validate_inventory(
    raw: bytes,
    *,
    expected_revision: str | None = None,
    expected_created: str | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    value = strict_json(raw, "VPS integration inventory")
    if raw != canonical_json(value) or not isinstance(value, dict):
        raise IntegrationError("VPS integration inventory must be canonical JSON")
    expected_keys = {"contract", "files", "schema", "source"}
    if set(value) != expected_keys:
        raise IntegrationError("VPS integration inventory has unexpected fields")
    literals = {"contract": "vps-infra.application-integration.v1", "schema": 1}
    for key, expected in literals.items():
        if value[key] != expected or type(value[key]) is not type(expected):
            raise IntegrationError(f"VPS integration inventory {key} is invalid")
    source = value["source"]
    if not isinstance(source, dict) or set(source) != {"repository", "revision"}:
        raise IntegrationError("VPS integration inventory source is invalid")
    if source["repository"] != SOURCE_REPOSITORY:
        raise IntegrationError("VPS integration inventory repository is invalid")
    revision = source["revision"]
    if not isinstance(revision, str) or REVISION_RE.fullmatch(revision) is None:
        raise IntegrationError("VPS integration inventory revision is invalid")
    if expected_revision is not None and revision != expected_revision:
        raise IntegrationError("VPS integration inventory revision does not match")
    if expected_created is not None:
        epoch_from_created(expected_created)
    files = value["files"]
    if not isinstance(files, list) or len(files) != len(RUNTIME_PATHS):
        raise IntegrationError("VPS integration file count is invalid")
    validated: list[dict[str, Any]] = []
    for path, entry in zip(RUNTIME_PATHS, files, strict=True):
        if not isinstance(entry, dict) or set(entry) != {"bytes", "path", "sha256"}:
            raise IntegrationError("VPS integration file entry is invalid")
        if entry["path"] != path:
            raise IntegrationError("VPS integration file allowlist is invalid")
        pure = PurePosixPath(path)
        if pure.is_absolute() or "." in pure.parts or ".." in pure.parts:
            raise IntegrationError("VPS integration path is unsafe")
        if type(entry["bytes"]) is not int or not 0 <= entry["bytes"] <= MAX_FILE_SIZE:
            raise IntegrationError("VPS integration file size is invalid")
        if (
            not isinstance(entry["sha256"], str)
            or HEX_SHA256_RE.fullmatch(entry["sha256"]) is None
        ):
            raise IntegrationError("VPS integration file digest is invalid")
        validated.append(entry)
    if sum(entry["bytes"] for entry in validated) > MAX_TOTAL_SIZE:
        raise IntegrationError("VPS integration inventory exceeds the total size limit")
    return value, validated


def _decompress_gzip_bounded(raw: bytes) -> bytes:
    if len(raw) > MAX_ARCHIVE_SIZE:
        raise IntegrationError("VPS integration archive exceeds the size limit")
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(raw), mode="rb") as compressed:
            result = compressed.read(MAX_TAR_SIZE + 1)
    except (EOFError, OSError) as exc:
        raise IntegrationError("VPS integration archive is not valid gzip") from exc
    if len(result) > MAX_TAR_SIZE:
        raise IntegrationError("expanded VPS integration archive exceeds the limit")
    return result


def verify_package(
    archive_bytes: bytes,
    inventory_bytes: bytes,
    *,
    expected_revision: str | None = None,
    expected_created: str | None = None,
) -> tuple[str, str, dict[str, bytes]]:
    inventory, expected_files = validate_inventory(
        inventory_bytes,
        expected_revision=expected_revision,
        expected_created=expected_created,
    )
    tar_bytes = _decompress_gzip_bounded(archive_bytes)
    runtime_files: list[RuntimeFile] = []
    extracted_files: dict[str, bytes] = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:") as archive:
            members = archive.getmembers()
            if len(members) != len(DIRECTORY_PATHS) + len(expected_files):
                raise IntegrationError("VPS integration archive file count is invalid")
            for member, expected_path in zip(
                members[: len(DIRECTORY_PATHS)], DIRECTORY_PATHS, strict=True
            ):
                if (
                    member.name != expected_path
                    or not member.isdir()
                    or member.type != tarfile.DIRTYPE
                    or member.mode != 0o755
                    or member.uid != 0
                    or member.gid != 0
                    or member.uname
                    or member.gname
                    or member.mtime != 0
                    or member.pax_headers
                ):
                    raise IntegrationError(
                        "VPS integration archive directory metadata is invalid"
                    )
            file_members = members[len(DIRECTORY_PATHS) :]
            for member, expected in zip(file_members, expected_files, strict=True):
                expected_path = f"integration/{expected['path']}"
                if member.name != expected_path:
                    raise IntegrationError(
                        "VPS integration archive order or path is invalid"
                    )
                pure = PurePosixPath(member.name)
                if pure.is_absolute() or "." in pure.parts or ".." in pure.parts:
                    raise IntegrationError("VPS integration archive path is unsafe")
                if (
                    not member.isfile()
                    or member.type != tarfile.REGTYPE
                    or member.pax_headers
                ):
                    raise IntegrationError(
                        "VPS integration archive contains a special file"
                    )
                if (
                    member.mode != 0o644
                    or member.uid != 0
                    or member.gid != 0
                    or member.uname
                    or member.gname
                ):
                    raise IntegrationError(
                        "VPS integration archive metadata is invalid"
                    )
                if member.mtime != 0:
                    raise IntegrationError(
                        "VPS integration archive timestamp is invalid"
                    )
                if member.size != expected["bytes"]:
                    raise IntegrationError("VPS integration archive size is invalid")
                source = archive.extractfile(member)
                if source is None:
                    raise IntegrationError("VPS integration file cannot be read")
                content = source.read(MAX_FILE_SIZE + 1)
                if (
                    len(content) != member.size
                    or hashlib.sha256(content).hexdigest() != expected["sha256"]
                ):
                    raise IntegrationError("VPS integration file content is invalid")
                _validate_text(content, member.name)
                relative_path = str(
                    PurePosixPath(member.name).relative_to("integration")
                )
                runtime_files.append(RuntimeFile(path=relative_path, content=content))
                extracted_files[relative_path] = content
    except (tarfile.TarError, EOFError) as exc:
        raise IntegrationError("VPS integration archive is not valid tar") from exc
    if archive_for(runtime_files, epoch=0) != archive_bytes:
        raise IntegrationError("VPS integration archive is not canonical")
    revision = inventory["source"]["revision"]
    validate_contract(extracted_files["contract.json"], revision)
    validate_caddy_route(extracted_files["caddy/surplasse.caddy"])
    validate_expected_images(extracted_files["expected-images.json"], revision)
    validate_migrations(extracted_files["migrations.json"], revision)
    validate_probes(extracted_files["probes.json"])
    return sha256(archive_bytes), sha256(inventory_bytes), extracted_files


def validate_manifest(
    manifest_bytes: bytes,
    *,
    expected_digest: str,
    archive_bytes: bytes,
    inventory_bytes: bytes,
    expected_revision: str,
    expected_created: str,
) -> None:
    if (
        SHA256_RE.fullmatch(expected_digest) is None
        or sha256(manifest_bytes) != expected_digest
    ):
        raise IntegrationError("published manifest bytes do not match its digest")
    manifest = strict_json(manifest_bytes, "published OCI manifest")
    if not isinstance(manifest, dict) or set(manifest) != {
        "annotations",
        "artifactType",
        "config",
        "layers",
        "mediaType",
        "schemaVersion",
    }:
        raise IntegrationError("published OCI manifest has unexpected fields")
    if (
        manifest["schemaVersion"] != 2
        or manifest["mediaType"] != OCI_MANIFEST_MEDIA_TYPE
    ):
        raise IntegrationError("published OCI manifest identity is invalid")
    if manifest["artifactType"] != ARTIFACT_TYPE:
        raise IntegrationError("published OCI artifact type is invalid")
    if manifest["config"] != {
        "data": "e30=",
        "digest": OCI_EMPTY_CONFIG_DIGEST,
        "mediaType": OCI_EMPTY_CONFIG_MEDIA_TYPE,
        "size": 2,
    }:
        raise IntegrationError("published OCI empty config is invalid")
    if manifest["annotations"] != {
        "org.opencontainers.image.created": expected_created,
        "org.opencontainers.image.revision": expected_revision,
        "org.opencontainers.image.source": SOURCE_URL,
    }:
        raise IntegrationError("published OCI annotations are invalid")
    layers = manifest["layers"]
    expected_layers = (
        (ARCHIVE_NAME, ARCHIVE_MEDIA_TYPE, archive_bytes),
        (INVENTORY_NAME, INVENTORY_MEDIA_TYPE, inventory_bytes),
    )
    if not isinstance(layers, list) or len(layers) != 2:
        raise IntegrationError("published OCI layer count is invalid")
    for layer, (title, media_type, content) in zip(
        layers, expected_layers, strict=True
    ):
        if layer != {
            "annotations": {"org.opencontainers.image.title": title},
            "digest": sha256(content),
            "mediaType": media_type,
            "size": len(content),
        }:
            raise IntegrationError(f"published OCI layer is invalid: {title}")


def evidence_bytes(
    *,
    artifact_reference: str,
    archive_bytes: bytes,
    inventory_bytes: bytes,
    revision: str,
    created: str,
    run_id: int,
    run_attempt: int,
) -> bytes:
    repository, separator, digest = artifact_reference.rpartition("@")
    if (
        not separator
        or repository != ARTIFACT_REPOSITORY
        or SHA256_RE.fullmatch(digest) is None
    ):
        raise IntegrationError("evidence artifact reference is invalid")
    if REVISION_RE.fullmatch(revision) is None:
        raise IntegrationError("evidence revision is invalid")
    epoch_from_created(created)
    if (
        type(run_id) is not int
        or run_id < 1
        or type(run_attempt) is not int
        or run_attempt < 1
    ):
        raise IntegrationError("evidence run identity is invalid")
    return canonical_json(
        {
            "archive": {
                "media_type": ARCHIVE_MEDIA_TYPE,
                "sha256": sha256(archive_bytes),
                "size": len(archive_bytes),
                "title": ARCHIVE_NAME,
            },
            "artifact": artifact_reference,
            "artifact_type": ARTIFACT_TYPE,
            "created": created,
            "inventory": {
                "media_type": INVENTORY_MEDIA_TYPE,
                "sha256": sha256(inventory_bytes),
                "size": len(inventory_bytes),
                "title": INVENTORY_NAME,
            },
            "run_attempt": run_attempt,
            "run_id": run_id,
            "schema": 1,
            "signer_workflow": SIGNER_WORKFLOW,
            "source": SOURCE_URL,
            "source_revision": revision,
            "verified_gates": [
                "canonical-content",
                "github-provenance",
                "oci-annotations",
                "oci-layer-descriptors",
                "published-manifest-digest",
                "registry-round-trip",
            ],
        }
    )
