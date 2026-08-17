"""Fail-closed same-revision GitHub Actions admission for application releases."""

from __future__ import annotations

import json
import http.client
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable

from vps_integration import (
    REVISION_RE,
    SOURCE_REPOSITORY,
    IntegrationError,
    canonical_json,
)


REQUIRED_WORKFLOWS = ("Container images", "Pages")
RELEASE_WORKFLOW = "VPS integration release"
MAX_GITHUB_RESPONSE_BYTES = 10 * 1024 * 1024
HTTP_TIMEOUT_SECONDS = 30


class GateError(IntegrationError):
    """Raised when a same-revision release gate cannot be admitted."""


class GatePending(GateError):
    """Raised while one admitted workflow has not completed."""


class RejectRedirects(urllib.request.HTTPRedirectHandler):
    """Reject redirects before the GitHub bearer token can leave its endpoint."""

    def redirect_request(self, *_arguments: object, **_keywords: object) -> None:
        raise GateError("GitHub API redirects are not permitted")


@dataclass(frozen=True)
class GateSnapshot:
    revision: str
    workflows: tuple[dict[str, object], ...]

    @property
    def signature(self) -> tuple[tuple[object, ...], ...]:
        return tuple(
            (
                run["id"],
                run["run_attempt"],
                run["name"],
                run["status"],
                run["conclusion"],
                run["updated_at"],
            )
            for run in self.workflows
        )

    def evidence(self) -> bytes:
        return canonical_json(
            {
                "repository": SOURCE_REPOSITORY,
                "required_workflows": list(REQUIRED_WORKFLOWS),
                "revision": self.revision,
                "schema": 1,
                "workflows": list(self.workflows),
            }
        )


def _integer(value: object, path: str) -> int:
    if type(value) is not int or value < 1:
        raise GateError(f"{path} must be a positive integer")
    return value


def evaluate_runs(*, revision: str, runs: object, current_run_id: int) -> GateSnapshot:
    if REVISION_RE.fullmatch(revision) is None:
        raise GateError("release revision must be a full lowercase Git SHA")
    _integer(current_run_id, "current run ID")
    if not isinstance(runs, list):
        raise GateError("GitHub workflow run response must be a list")
    admitted: list[dict[str, object]] = []
    for candidate in runs:
        if not isinstance(candidate, dict):
            raise GateError("GitHub workflow run entry must be an object")
        run_id = _integer(candidate.get("id"), "workflow run ID")
        if run_id == current_run_id:
            continue
        if candidate.get("event") != "push" or candidate.get("head_branch") != "main":
            raise GateError("GitHub returned an out-of-scope workflow run")
        if candidate.get("head_sha") != revision:
            raise GateError("GitHub returned a workflow run for another revision")
        head_repository = candidate.get("head_repository")
        if (
            not isinstance(head_repository, dict)
            or head_repository.get("full_name") != SOURCE_REPOSITORY
        ):
            raise GateError(
                "workflow run does not originate from the canonical repository"
            )
        name = candidate.get("name")
        status = candidate.get("status")
        conclusion = candidate.get("conclusion")
        attempt = _integer(candidate.get("run_attempt"), "workflow run attempt")
        updated_at = candidate.get("updated_at")
        if not isinstance(name, str) or not name or not isinstance(updated_at, str):
            raise GateError("workflow run identity is incomplete")
        admitted.append(
            {
                "conclusion": conclusion,
                "id": run_id,
                "name": name,
                "run_attempt": attempt,
                "status": status,
                "updated_at": updated_at,
            }
        )
    if len(admitted) > 100:
        raise GateError("more than one API page of workflow runs is not admissible")
    names = {str(run["name"]) for run in admitted}
    missing = set(REQUIRED_WORKFLOWS) - names
    if missing:
        raise GatePending(
            f"required workflows are missing: {', '.join(sorted(missing))}"
        )
    for run in admitted:
        if run["status"] != "completed":
            raise GatePending(f"workflow {run['name']} has not completed")
        if run["conclusion"] != "success":
            raise GateError(
                f"workflow {run['name']} concluded with {run['conclusion']!r}"
            )
    admitted.sort(key=lambda run: (str(run["name"]), int(run["id"])))
    return GateSnapshot(revision=revision, workflows=tuple(admitted))


class GitHubClient:
    def __init__(
        self,
        *,
        token: str,
        repository: str = SOURCE_REPOSITORY,
        opener: object | None = None,
    ) -> None:
        if not 1 <= len(token) <= 8192 or any(
            ord(character) < 33 or ord(character) > 126 for character in token
        ):
            raise GateError("GitHub token is missing or contains unsafe bytes")
        if repository != SOURCE_REPOSITORY:
            raise GateError("only the canonical repository may publish a release")
        self.token = token
        self.repository = repository
        self._opener = opener or urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            RejectRedirects(),
            urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        )

    def get(self, path: str, query: dict[str, str] | None = None) -> object:
        suffix = f"?{urllib.parse.urlencode(query)}" if query else ""
        request = urllib.request.Request(
            f"https://api.github.com{path}{suffix}",
            headers={
                "Accept": "application/vnd.github+json",
                "Accept-Encoding": "identity",
                "Authorization": f"Bearer {self.token}",
                "User-Agent": "surplasse-application-release",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        url = request.full_url
        parsed = urllib.parse.urlsplit(url)
        if (
            parsed.scheme != "https"
            or parsed.hostname != "api.github.com"
            or parsed.username
            or parsed.password
            or parsed.fragment
        ):
            raise GateError("GitHub API URL is outside the exact HTTPS endpoint")
        try:
            response = self._opener.open(request, timeout=HTTP_TIMEOUT_SECONDS)
            with response:
                if response.geturl() != url:
                    raise GateError("GitHub API response changed the exact endpoint")
                status = response.getcode()
                if status != 200:
                    raise GateError(f"GitHub API returned unexpected status {status}")
                content_length = response.headers.get("Content-Length")
                if content_length is not None and (
                    not content_length.isdecimal()
                    or int(content_length) > MAX_GITHUB_RESPONSE_BYTES
                ):
                    raise GateError(
                        "GitHub API Content-Length exceeds the safety limit"
                    )
                content_encoding = response.headers.get("Content-Encoding")
                if (
                    content_encoding is not None
                    and content_encoding.lower() != "identity"
                ):
                    raise GateError("GitHub API response uses an unexpected encoding")
                raw = response.read(MAX_GITHUB_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as exc:
            status = exc.code
            exc.read(4097)
            exc.close()
            if status == 429 or 500 <= status <= 599:
                raise GatePending(
                    f"GitHub API temporarily returned status {status}"
                ) from exc
            raise GateError(f"GitHub API returned status {status}") from exc
        except GateError:
            raise
        except (
            urllib.error.URLError,
            TimeoutError,
            http.client.HTTPException,
            OSError,
        ) as exc:
            raise GatePending(f"GitHub API request failed: {exc}") from exc
        if len(raw) > MAX_GITHUB_RESPONSE_BYTES:
            raise GateError("GitHub API response exceeds the safety limit")
        try:
            return json.loads(raw.decode("utf-8", errors="strict"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise GateError("GitHub API returned invalid JSON") from exc

    def canonical_head(self) -> str:
        value = self.get(f"/repos/{self.repository}/git/ref/heads/main")
        if not isinstance(value, dict):
            raise GateError("GitHub main ref response is invalid")
        target = value.get("object")
        revision = target.get("sha") if isinstance(target, dict) else None
        if not isinstance(revision, str) or REVISION_RE.fullmatch(revision) is None:
            raise GateError("GitHub main ref target is invalid")
        return revision

    def push_runs(self, revision: str) -> list[dict[str, Any]]:
        value = self.get(
            f"/repos/{self.repository}/actions/runs",
            {"event": "push", "head_sha": revision, "per_page": "100"},
        )
        if not isinstance(value, dict) or value.get("total_count") is None:
            raise GateError("GitHub workflow runs response is invalid")
        if type(value["total_count"]) is not int or value["total_count"] > 100:
            raise GateError("workflow run result does not fit in one admitted page")
        runs = value.get("workflow_runs")
        if not isinstance(runs, list):
            raise GateError("GitHub workflow runs list is invalid")
        return runs


def wait_for_gates(
    *,
    client: GitHubClient,
    revision: str,
    current_run_id: int,
    timeout_seconds: int = 2700,
    poll_seconds: int = 15,
    stable_polls: int = 2,
    sleeper: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> GateSnapshot:
    if timeout_seconds < 1 or poll_seconds < 1 or stable_polls < 1:
        raise GateError("gate polling bounds must be positive")
    deadline = monotonic() + timeout_seconds
    last_signature: tuple[tuple[object, ...], ...] | None = None
    stable = 0
    pending_message = "same-revision gates have not been observed"
    while monotonic() <= deadline:
        if client.canonical_head() != revision:
            raise GateError("release revision is no longer canonical main HEAD")
        try:
            snapshot = evaluate_runs(
                revision=revision,
                runs=client.push_runs(revision),
                current_run_id=current_run_id,
            )
        except GatePending as exc:
            pending_message = str(exc)
            last_signature = None
            stable = 0
        else:
            if snapshot.signature == last_signature:
                stable += 1
            else:
                last_signature = snapshot.signature
                stable = 1
            if stable >= stable_polls:
                return snapshot
        if monotonic() + poll_seconds > deadline:
            break
        sleeper(poll_seconds)
    raise GateError(f"timed out waiting for same-revision gates: {pending_message}")
