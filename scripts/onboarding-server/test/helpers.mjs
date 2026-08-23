import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = resolve(packageRoot, "../..");

export async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return server.address().port;
}

export async function close(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}

export function request(port, options = {}) {
  const body = options.body ?? "";
  const headers = options.rawHeaders ?? { ...(options.headers ?? {}) };
  if (body && !options.rawHeaders && !headers["Content-Length"]) {
    headers["Content-Length"] = Buffer.byteLength(body);
  }
  return new Promise((resolveRequest, rejectRequest) => {
    const outgoing = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: options.path ?? "/",
        method: options.method ?? "GET",
        headers,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolveRequest({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outgoing.once("error", rejectRequest);
    outgoing.end(body);
  });
}
