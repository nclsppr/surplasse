from __future__ import annotations

import re
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
