from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

import vps_integration as integration  # noqa: E402


REVISION = "1" * 40


def component_images(revision: str = REVISION) -> dict[str, str]:
    del revision
    return {
        name: f"{repository}@sha256:{index:064x}"
        for index, (name, repository) in enumerate(
            integration.COMPONENT_REPOSITORIES.items(), start=1
        )
    }


def migrations_raw(revision: str = REVISION) -> bytes:
    return integration.canonical_json(
        {
            "contract": "surplasse.flyway-migrations",
            "database": "surplasse",
            "migrations": [
                {
                    "path": "backend/catalog/src/main/resources/db/migration/V1__one.sql",
                    "sha256": "a" * 64,
                    "version": 1,
                }
            ],
            "runner": "/opt/surplasse/scripts/backend-migrate.sh",
            "runtime_auto_migrate": False,
            "schema": 1,
            "source_repository": "nclsppr/surplasse",
            "source_revision": revision,
        }
    )


def probes_raw() -> bytes:
    return integration.canonical_json(
        {
            "contract": "surplasse.probes",
            "internal": [
                {
                    "body_contains": "UP",
                    "service": "backend",
                    "status": 200,
                    "url": "http://surplasse-backend:8080/q/health/ready",
                },
                {
                    "body_contains": "ready",
                    "service": "onboarding",
                    "status": 200,
                    "url": "http://surplasse-onboarding:8080/__health",
                },
                {
                    "body_contains": "ready",
                    "service": "commande",
                    "status": 200,
                    "url": "http://surplasse-commande:8080/healthz",
                },
                {
                    "body_contains": "ready",
                    "service": "dashboard",
                    "status": 200,
                    "url": "http://surplasse-dashboard:8080/healthz",
                },
                {
                    "body_contains": "ready",
                    "service": "docs",
                    "status": 200,
                    "url": "http://surplasse-docs:8080/healthz",
                },
            ],
            "public": [
                {
                    "body_contains": "surplasse-edge-v1",
                    "host": "surplasse.com",
                    "path": "/.well-known/surplasse-edge",
                    "status": 200,
                },
                {"host": "surplasse.com", "path": "/", "status": 200},
                {
                    "host": "dashboard.surplasse.com",
                    "path": "/",
                    "status": 200,
                },
                {"host": "docs.surplasse.com", "path": "/", "status": 200},
                {"host": "probe.surplasse.com", "path": "/", "status": 200},
                {
                    "host": "api.surplasse.com",
                    "path": "/q/health/ready",
                    "status": 404,
                },
            ],
            "schema": 1,
        }
    )


def caddy_raw() -> bytes:
    return (
        "https://surplasse.com, https://*.surplasse.com {\n"
        f"\t{integration.ATLAS_TLS_IMPORT}\n"
        "\trespond \"ready\" 200\n"
        "}\n"
    ).encode()


def runtime_files() -> list[integration.RuntimeFile]:
    generated = {
        "caddy/surplasse.caddy": caddy_raw(),
        "contract.json": integration.contract_bytes(REVISION),
        "expected-images.json": integration.expected_images_bytes(
            component_images(), REVISION
        ),
        "migrations.json": migrations_raw(),
        "probes.json": probes_raw(),
    }
    return [
        integration.RuntimeFile(path=path, content=generated.get(path, b"safe\n"))
        for path in integration.RUNTIME_PATHS
    ]


def package_bytes() -> tuple[bytes, bytes]:
    files = runtime_files()
    archive = integration.archive_for(files, epoch=0)
    inventory = integration.canonical_json(
        integration.inventory_for(files, revision=REVISION)
    )
    return archive, inventory


class GitRepository:
    def __init__(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary.name)
        self._run("git", "init", "-q")
        self._run("git", "config", "user.email", "tests@surplasse.invalid")
        self._run("git", "config", "user.name", "Surplasse tests")
        sources = set(integration.STATIC_FILES.values()) | {
            "deployment/vps/probes.json"
        }
        for source in sources:
            path = self.path / source
            path.parent.mkdir(parents=True, exist_ok=True)
            if source.endswith("probes.json"):
                content = probes_raw().decode()
            elif source.endswith("surplasse.caddy"):
                content = caddy_raw().decode()
            else:
                content = "safe\n"
            path.write_text(content)
        migration = (
            self.path / "backend/catalog/src/main/resources/db/migration/V1__one.sql"
        )
        migration.parent.mkdir(parents=True, exist_ok=True)
        migration.write_text("select 1;\n")
        self._run("git", "add", ".")
        env = {
            **os.environ,
            "GIT_AUTHOR_DATE": "2026-08-17T12:00:00Z",
            "GIT_COMMITTER_DATE": "2026-08-17T12:00:00Z",
        }
        self._run("git", "commit", "-qm", "fixture", env=env)
        self.revision = self._run("git", "rev-parse", "HEAD").strip()

    def _run(self, *argv: str, env: dict[str, str] | None = None) -> str:
        return subprocess.run(
            argv,
            cwd=self.path,
            env=env,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
        ).stdout

    def close(self) -> None:
        self.temporary.cleanup()


class VpsIntegrationTests(unittest.TestCase):
    def test_package_is_canonical_and_deterministic(self) -> None:
        archive, inventory = package_bytes()
        archive_digest, inventory_digest, files = integration.verify_package(
            archive,
            inventory,
            expected_revision=REVISION,
            expected_created="2026-08-17T12:00:00Z",
        )
        self.assertEqual(archive_digest, integration.sha256(archive))
        self.assertEqual(inventory_digest, integration.sha256(inventory))
        self.assertEqual(set(files), set(integration.RUNTIME_PATHS))
        self.assertEqual(package_bytes(), (archive, inventory))
        inventory_value = json.loads(inventory)
        self.assertEqual(
            set(inventory_value), {"contract", "files", "schema", "source"}
        )
        self.assertEqual(
            inventory_value["contract"],
            "vps-infra.application-integration.v1",
        )
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
            contract = json.load(bundle.extractfile("integration/contract.json"))
        self.assertEqual(contract["payment"], integration.PAYMENT_PROFILE)
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
            self.assertEqual(
                [member.name for member in bundle.getmembers()],
                [
                    *integration.DIRECTORY_PATHS,
                    *(f"integration/{path}" for path in integration.RUNTIME_PATHS),
                ],
            )

    def test_contract_rejects_every_tester_payment_profile_divergence(self) -> None:
        invalid_profiles = {
            "missing": None,
            "live": {"audience": "testers", "mode": "live", "schema": 1},
            "public": {"audience": "public", "mode": "test", "schema": 1},
            "schema": {"audience": "testers", "mode": "test", "schema": 2},
            "extra": {
                "audience": "testers",
                "mode": "test",
                "schema": 1,
                "operator_override": True,
            },
        }
        for label, payment in invalid_profiles.items():
            with self.subTest(divergence=label):
                value = json.loads(integration.contract_bytes(REVISION))
                if payment is None:
                    value.pop("payment")
                else:
                    value["payment"] = payment
                with self.assertRaisesRegex(
                    integration.IntegrationError,
                    "exact canonical policy",
                ):
                    integration.validate_contract(
                        integration.canonical_json(value), REVISION
                    )

    def test_exact_commit_ignores_dirty_worktree(self) -> None:
        repository = GitRepository()
        self.addCleanup(repository.close)
        first = integration.build_package(
            repository.path, repository.revision, component_images(repository.revision)
        )
        (repository.path / "deployment/vps/compose.yaml").write_text("dirty\n")
        second = integration.build_package(
            repository.path, repository.revision, component_images(repository.revision)
        )
        self.assertEqual(first, second)

    def test_builder_rejects_symlinked_runtime_file(self) -> None:
        repository = GitRepository()
        self.addCleanup(repository.close)
        target = repository.path / "deployment/vps/compose.yaml"
        target.unlink()
        target.symlink_to("probes.json")
        repository._run("git", "add", "deployment/vps/compose.yaml")
        repository._run("git", "commit", "-qm", "symlink")
        revision = repository._run("git", "rev-parse", "HEAD").strip()
        with self.assertRaisesRegex(integration.IntegrationError, "unsafe tracked"):
            integration.build_package(
                repository.path, revision, component_images(revision)
            )

    def test_duplicate_json_key_is_rejected(self) -> None:
        with self.assertRaisesRegex(integration.IntegrationError, "duplicate"):
            integration.strict_json(b'{"schema":1,"schema":1}\n', "fixture")

    def test_noncanonical_inventory_is_rejected(self) -> None:
        archive, inventory = package_bytes()
        value = json.loads(inventory)
        pretty = json.dumps(value, indent=2).encode()
        with self.assertRaisesRegex(integration.IntegrationError, "canonical"):
            integration.verify_package(archive, pretty)

    def test_tampered_inventory_digest_is_rejected(self) -> None:
        archive, inventory = package_bytes()
        value = json.loads(inventory)
        value["files"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(integration.IntegrationError, "content"):
            integration.verify_package(archive, integration.canonical_json(value))

    def test_special_tar_member_is_rejected(self) -> None:
        _, inventory = package_bytes()
        raw_tar = io.BytesIO()
        with tarfile.open(
            fileobj=raw_tar, mode="w", format=tarfile.USTAR_FORMAT
        ) as archive:
            member = tarfile.TarInfo(integration.RUNTIME_PATHS[0])
            member.type = tarfile.SYMTYPE
            member.linkname = "elsewhere"
            archive.addfile(member)
        compressed = io.BytesIO()
        with integration.gzip.GzipFile(
            filename="", fileobj=compressed, mode="wb", mtime=0
        ) as output:
            output.write(raw_tar.getvalue())
        with self.assertRaises(integration.IntegrationError):
            integration.verify_package(compressed.getvalue(), inventory)

    def test_migrator_must_equal_backend(self) -> None:
        raw = json.loads(
            integration.expected_images_bytes(component_images(), REVISION)
        )
        raw["images"]["migrator"] = raw["images"]["docs"]
        with self.assertRaisesRegex(integration.IntegrationError, "migrator"):
            integration.validate_expected_images(
                integration.canonical_json(raw), REVISION
            )

    def test_migration_versions_must_be_contiguous(self) -> None:
        value = json.loads(migrations_raw())
        value["migrations"][0]["version"] = 2
        with self.assertRaisesRegex(integration.IntegrationError, "contiguous"):
            integration.validate_migrations(integration.canonical_json(value), REVISION)

    def test_public_probe_must_use_allowed_host(self) -> None:
        value = json.loads(probes_raw())
        value["public"][0]["host"] = "attacker.invalid"
        with self.assertRaisesRegex(integration.IntegrationError, "endpoint"):
            integration.validate_probes(integration.canonical_json(value))

    def test_caddy_route_requires_exact_atlas_tls_import(self) -> None:
        integration.validate_caddy_route(caddy_raw())
        for invalid in (
            caddy_raw().replace(
                integration.ATLAS_TLS_IMPORT.encode(),
                b"import /etc/caddy/other-tls.caddy",
            ),
            caddy_raw()
            + b"tls {\n\tdns ovh {\n\t\tendpoint example.invalid\n\t}\n}\n",
        ):
            with self.assertRaises(integration.IntegrationError):
                integration.validate_caddy_route(invalid)

    def test_manifest_binds_exact_layers(self) -> None:
        archive, inventory = package_bytes()
        created = "2026-08-17T12:00:00Z"
        manifest = integration.canonical_json(
            {
                "annotations": {
                    "org.opencontainers.image.created": created,
                    "org.opencontainers.image.revision": REVISION,
                    "org.opencontainers.image.source": integration.SOURCE_URL,
                },
                "artifactType": integration.ARTIFACT_TYPE,
                "config": {
                    "data": "e30=",
                    "digest": integration.OCI_EMPTY_CONFIG_DIGEST,
                    "mediaType": integration.OCI_EMPTY_CONFIG_MEDIA_TYPE,
                    "size": 2,
                },
                "layers": [
                    {
                        "annotations": {
                            "org.opencontainers.image.title": integration.ARCHIVE_NAME
                        },
                        "digest": integration.sha256(archive),
                        "mediaType": integration.ARCHIVE_MEDIA_TYPE,
                        "size": len(archive),
                    },
                    {
                        "annotations": {
                            "org.opencontainers.image.title": integration.INVENTORY_NAME
                        },
                        "digest": integration.sha256(inventory),
                        "mediaType": integration.INVENTORY_MEDIA_TYPE,
                        "size": len(inventory),
                    },
                ],
                "mediaType": integration.OCI_MANIFEST_MEDIA_TYPE,
                "schemaVersion": 2,
            }
        )
        integration.validate_manifest(
            manifest,
            expected_digest=integration.sha256(manifest),
            archive_bytes=archive,
            inventory_bytes=inventory,
            expected_revision=REVISION,
            expected_created=created,
        )
        tampered = json.loads(manifest)
        tampered["layers"][0]["size"] += 1
        raw = integration.canonical_json(tampered)
        with self.assertRaisesRegex(integration.IntegrationError, "layer"):
            integration.validate_manifest(
                raw,
                expected_digest=integration.sha256(raw),
                archive_bytes=archive,
                inventory_bytes=inventory,
                expected_revision=REVISION,
                expected_created=created,
            )


if __name__ == "__main__":
    unittest.main()
