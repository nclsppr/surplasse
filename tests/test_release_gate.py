from __future__ import annotations

import email.message
import io
import os
import sys
import unittest
import urllib.request
import urllib.response
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

import release_gate as gate  # noqa: E402


REVISION = "1" * 40


def run(
    name: str, *, status: str = "completed", conclusion: str | None = "success"
) -> dict[str, object]:
    return {
        "conclusion": conclusion,
        "event": "push",
        "head_branch": "main",
        "head_repository": {"full_name": "nclsppr/surplasse"},
        "head_sha": REVISION,
        "id": 100 + len(name),
        "name": name,
        "run_attempt": 1,
        "status": status,
        "updated_at": "2026-08-17T12:00:00Z",
    }


def green_runs() -> list[dict[str, object]]:
    return [run("Container images"), run("Pages"), run("Backend")]


class FakeClient:
    def __init__(self, heads: list[str], runs: list[dict[str, object]]) -> None:
        self.heads = heads
        self.runs = runs
        self.calls = 0

    def canonical_head(self) -> str:
        index = min(self.calls, len(self.heads) - 1)
        return self.heads[index]

    def push_runs(self, revision: str) -> list[dict[str, object]]:
        self.calls += 1
        return self.runs


class RedirectingHttpsHandler(urllib.request.HTTPSHandler):
    def __init__(self) -> None:
        super().__init__()
        self.opened_urls: list[str] = []

    def https_open(self, request: urllib.request.Request):  # type: ignore[no-untyped-def]
        self.opened_urls.append(request.full_url)
        headers = email.message.Message()
        headers["Location"] = "https://attacker.invalid/token"
        response = urllib.response.addinfourl(
            io.BytesIO(b""), headers, request.full_url, code=302
        )
        response.msg = "Found"
        return response


class ReleaseGateTests(unittest.TestCase):
    def test_green_required_and_observed_workflows_are_admitted(self) -> None:
        snapshot = gate.evaluate_runs(
            revision=REVISION, runs=green_runs(), current_run_id=999
        )
        self.assertEqual(snapshot.revision, REVISION)
        self.assertEqual(len(snapshot.workflows), 3)

    def test_missing_required_workflow_is_pending(self) -> None:
        with self.assertRaisesRegex(gate.GatePending, "missing"):
            gate.evaluate_runs(
                revision=REVISION,
                runs=[run("Container images")],
                current_run_id=999,
            )

    def test_in_progress_workflow_is_pending(self) -> None:
        runs = green_runs()
        runs[0] = run("Container images", status="in_progress", conclusion=None)
        with self.assertRaisesRegex(gate.GatePending, "not completed"):
            gate.evaluate_runs(revision=REVISION, runs=runs, current_run_id=999)

    def test_red_observed_workflow_fails_closed(self) -> None:
        runs = green_runs() + [run("Frontends", conclusion="failure")]
        with self.assertRaisesRegex(gate.GateError, "failure"):
            gate.evaluate_runs(revision=REVISION, runs=runs, current_run_id=999)

    def test_fork_or_wrong_event_fails_closed(self) -> None:
        runs = green_runs()
        runs[0]["head_repository"] = {"full_name": "someone/surplasse"}
        with self.assertRaisesRegex(gate.GateError, "canonical"):
            gate.evaluate_runs(revision=REVISION, runs=runs, current_run_id=999)

    def test_current_release_run_is_ignored(self) -> None:
        current = run(gate.RELEASE_WORKFLOW, status="in_progress", conclusion=None)
        current["id"] = 999
        snapshot = gate.evaluate_runs(
            revision=REVISION, runs=green_runs() + [current], current_run_id=999
        )
        self.assertNotIn(
            gate.RELEASE_WORKFLOW, {row["name"] for row in snapshot.workflows}
        )

    def test_two_stable_polls_are_required(self) -> None:
        client = FakeClient([REVISION], green_runs())
        clock = iter([0.0, 0.0, 0.0, 1.0, 1.0])
        snapshot = gate.wait_for_gates(
            client=client,  # type: ignore[arg-type]
            revision=REVISION,
            current_run_id=999,
            timeout_seconds=10,
            poll_seconds=1,
            stable_polls=2,
            sleeper=lambda _: None,
            monotonic=lambda: next(clock),
        )
        self.assertEqual(client.calls, 2)
        self.assertEqual(snapshot.revision, REVISION)

    def test_stale_main_head_fails_before_admission(self) -> None:
        client = FakeClient(["2" * 40], green_runs())
        with self.assertRaisesRegex(gate.GateError, "no longer canonical"):
            gate.wait_for_gates(
                client=client,  # type: ignore[arg-type]
                revision=REVISION,
                current_run_id=999,
                timeout_seconds=1,
                poll_seconds=1,
                sleeper=lambda _: None,
                monotonic=lambda: 0,
            )

    def test_authorized_request_rejects_redirect_before_second_host(self) -> None:
        transport = RedirectingHttpsHandler()
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), gate.RejectRedirects(), transport
        )
        client = gate.GitHubClient(token="private-token", opener=opener)
        with self.assertRaisesRegex(gate.GateError, "redirects are not permitted"):
            client.get("/repos/nclsppr/surplasse/git/ref/heads/main")
        self.assertEqual(
            transport.opened_urls,
            ["https://api.github.com/repos/nclsppr/surplasse/git/ref/heads/main"],
        )

    def test_proxy_environment_is_explicitly_ignored(self) -> None:
        sentinel = object()
        with (
            mock.patch.dict(
                os.environ,
                {"HTTPS_PROXY": "http://attacker.invalid:8080"},
            ),
            mock.patch.object(
                urllib.request, "build_opener", return_value=sentinel
            ) as build_opener,
        ):
            client = gate.GitHubClient(token="private-token")
        self.assertIs(client._opener, sentinel)
        proxy_handlers = [
            argument
            for argument in build_opener.call_args.args
            if isinstance(argument, urllib.request.ProxyHandler)
        ]
        self.assertEqual(len(proxy_handlers), 1)
        self.assertEqual(proxy_handlers[0].proxies, {})


if __name__ == "__main__":
    unittest.main()
