from __future__ import annotations

import hashlib
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RepositoryReleaseContractTests(unittest.TestCase):
    def test_workflow_has_stable_checks_and_push_trigger(self) -> None:
        workflow = (ROOT / ".github/workflows/vps-integration.yml").read_text()
        self.assertIn("name: Validate application release", workflow)
        self.assertIn("name: Publish immutable application release", workflow)
        self.assertIn("push:\n    branches:\n      - main", workflow)
        self.assertIn("pull_request:\n    branches:\n      - main", workflow)
        self.assertNotIn("workflow_run", workflow)
        self.assertIn("ghcr.io/${{ github.repository }}/application-release", workflow)
        self.assertIn("application/vnd.vps-infra.application-release.v1", workflow)
        self.assertIn("application/vnd.vps-infra.application-integration.v1", workflow)
        self.assertIn('"integration.tar.gz:${VPS_ARCHIVE_MEDIA_TYPE}"', workflow)
        self.assertIn('"inventory.json:${VPS_INVENTORY_MEDIA_TYPE}"', workflow)
        self.assertIn('--source-digest "${GITHUB_SHA}"', workflow)
        self.assertIn("--deny-self-hosted-runners", workflow)

    def test_every_main_push_rebuilds_exact_sha_images(self) -> None:
        workflow = (ROOT / ".github/workflows/images.yml").read_text()
        push_block = workflow.split("  pull_request:", maxsplit=1)[0]
        self.assertIn("  push:\n    branches:\n      - main", push_block)
        self.assertNotIn("paths:", push_block)
        self.assertIn(
            "tags: ${{ env.IMAGE_ROOT }}/${{ matrix.image }}:${{ github.sha }}",
            workflow,
        )

    def test_main_image_release_requires_and_embeds_live_stripe_key(self) -> None:
        workflow = (ROOT / ".github/workflows/images.yml").read_text()
        self.assertIn(
            "if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
            workflow,
        )
        self.assertGreaterEqual(
            workflow.count("./scripts/validate-production-stripe-public-key"),
            4,
        )
        self.assertEqual(
            workflow.count('REQUIRE_EXPECTED_STRIPE_PUBLIC_KEY_SHA256: "true"'),
            4,
        )
        self.assertIn(
            "matrix.image == 'commande' && github.event_name == 'push' "
            "&& github.ref == 'refs/heads/main' "
            "&& vars.VITE_STRIPE_PUBLISHABLE_KEY || ''",
            workflow,
        )
        self.assertIn(
            "needs.configuration.outputs.stripe_public_key_sha256",
            workflow,
        )
        self.assertIn(
            '"${IMAGE_ROOT}/commande@${{ steps.push.outputs.digest }}"',
            workflow,
        )
        self.assertIn(
            "image-ref: ${{ env.IMAGE_ROOT }}/${{ matrix.image }}"
            "@${{ steps.push.outputs.digest }}",
            workflow,
        )
        self.assertEqual(
            workflow.count("< ./scripts/verify-production-stripe-static-assets"),
            2,
        )
        self.assertIn("docker run --rm --interactive \\\n", workflow)
        self.assertIn("docker run --rm --interactive --pull=always \\\n", workflow)
        self.assertNotIn("commande|dashboard)", workflow)

    def test_production_stripe_key_validator_fails_closed(self) -> None:
        validator = ROOT / "scripts/validate-production-stripe-public-key"
        for value in (
            None,
            "",
            "pk_live_",
            "pk_test_example",
            "pk_live_value with space",
            "pk_live_value\nsecond_line",
        ):
            environment = os.environ.copy()
            environment.pop("EXPECTED_STRIPE_PUBLIC_KEY_SHA256", None)
            environment.pop("REQUIRE_EXPECTED_STRIPE_PUBLIC_KEY_SHA256", None)
            if value is None:
                environment.pop("VITE_STRIPE_PUBLISHABLE_KEY", None)
            else:
                environment["VITE_STRIPE_PUBLISHABLE_KEY"] = value
            result = subprocess.run(
                [validator],
                check=False,
                capture_output=True,
                env=environment,
                text=True,
            )
            self.assertEqual(result.returncode, 64)
            self.assertNotIn(value or "pk_live_", result.stderr)

        environment = os.environ.copy()
        environment.pop("EXPECTED_STRIPE_PUBLIC_KEY_SHA256", None)
        environment.pop("REQUIRE_EXPECTED_STRIPE_PUBLIC_KEY_SHA256", None)
        environment["VITE_STRIPE_PUBLISHABLE_KEY"] = "pk_live_contract"
        result = subprocess.run(
            [validator],
            check=False,
            capture_output=True,
            env=environment,
            text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

        environment["REQUIRE_EXPECTED_STRIPE_PUBLIC_KEY_SHA256"] = "true"
        result = subprocess.run(
            [validator],
            check=False,
            capture_output=True,
            env=environment,
            text=True,
        )
        self.assertEqual(result.returncode, 64)
        self.assertNotIn("pk_live_contract", result.stderr)

        environment["EXPECTED_STRIPE_PUBLIC_KEY_SHA256"] = hashlib.sha256(
            b"pk_live_contract"
        ).hexdigest()
        result = subprocess.run(
            [validator],
            check=False,
            capture_output=True,
            env=environment,
            text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

        environment["EXPECTED_STRIPE_PUBLIC_KEY_SHA256"] = "0" * 64
        result = subprocess.run(
            [validator],
            check=False,
            capture_output=True,
            env=environment,
            text=True,
        )
        self.assertEqual(result.returncode, 64)
        self.assertNotIn("pk_live_contract", result.stderr)

    def test_static_stripe_key_validator_follows_the_html_entrypoint(self) -> None:
        validator = ROOT / "scripts/verify-production-stripe-static-assets"
        key = "pk_live_contract"
        environment = os.environ.copy()
        environment["VITE_STRIPE_PUBLISHABLE_KEY"] = key

        with tempfile.TemporaryDirectory() as directory:
            site_root = Path(directory)
            assets = site_root / "assets"
            assets.mkdir()
            (site_root / "index.html").write_text(
                '<script type="module" src="/assets/application.js"></script>'
            )
            entrypoint = assets / "application.js"
            dead_chunk = assets / "dead.js"

            entrypoint.write_text(f'const stripeKey = "{key}";')
            result = subprocess.run(
                [validator, site_root],
                check=False,
                capture_output=True,
                env=environment,
                text=True,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertEqual(result.stderr, "")

            entrypoint.write_text('const state = "missing";')
            dead_chunk.write_text(f'const stripeKey = "{key}";')
            result = subprocess.run(
                [validator, site_root],
                check=False,
                capture_output=True,
                env=environment,
                text=True,
            )
            self.assertEqual(result.returncode, 64)
            self.assertNotIn(key, result.stderr)

            entrypoint.write_text(
                f'const stripeKey = "{key}"; const stale = "pk_test_stale";'
            )
            result = subprocess.run(
                [validator, site_root],
                check=False,
                capture_output=True,
                env=environment,
                text=True,
            )
            self.assertEqual(result.returncode, 64)
            self.assertNotIn(key, result.stderr)

    def test_release_gate_budget_covers_the_full_image_workflow(self) -> None:
        release_workflow = (
            ROOT / ".github/workflows/vps-integration.yml"
        ).read_text()
        gate = (ROOT / "scripts/wait-vps-release-gates").read_text()
        self.assertIn('default=9000', gate)
        self.assertIn("--timeout 9000", release_workflow)
        publish_block = release_workflow.split("  publish:\n", maxsplit=1)[1]
        timeout = re.search(r"timeout-minutes: ([0-9]+)", publish_block)
        self.assertIsNotNone(timeout)
        self.assertGreater(int(timeout.group(1)) * 60, 9000 + 45 * 60)

    def test_edge_fragment_leaves_certificate_automation_to_atlas(self) -> None:
        caddy = (ROOT / "deployment/vps/caddy/surplasse.caddy").read_text()
        self.assertNotIn("dns ovh", caddy)
        self.assertNotIn("OVH_", caddy)
        self.assertNotRegex(caddy, r"(?m)^\s*tls(?:\s|\{)")

    def test_compose_bundle_is_application_only(self) -> None:
        compose = (ROOT / "deployment/vps/compose.yaml").read_text()
        for service in (
            "backend",
            "onboarding",
            "commande",
            "dashboard",
            "docs",
            "migrator",
        ):
            self.assertIn(f"  {service}:\n", compose)
        for excluded in (
            "  postgresql:\n",
            "  edge:\n",
            "  prometheus:\n",
            "  grafana:\n",
        ):
            self.assertNotIn(excluded, compose)
        self.assertNotIn("ports:", compose)
        self.assertIn('QUARKUS_FLYWAY_MIGRATE_AT_START: "false"', compose)
        self.assertIn('restart: "no"', compose)
        self.assertIn("external: true", compose)

    def test_no_secret_value_is_packaged(self) -> None:
        for path in (ROOT / "deployment/vps").rglob("*"):
            if path.is_file():
                text = path.read_text()
                self.assertNotIn("change-me", text)
                self.assertNotIn("BEGIN PRIVATE KEY", text)
                self.assertNotIn("sk_live_", text)


if __name__ == "__main__":
    unittest.main()
