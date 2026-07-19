import assert from "node:assert/strict";
import test from "node:test";
import tls from "node:tls";

import { createPublicUrlProbe, probePublicUrl } from "../system.mjs";

const VALID_CERTIFICATE = tls.getCACertificates("default")[0];

test("public HTTPS probe validates configuration, system DNS and strict TLS options", async () => {
  let lookupCall;
  let requestCall;
  const result = await probePublicUrl(health(), probeOptions({
    lookup: async (...args) => {
      lookupCall = args;
      return [{ address: "127.0.0.1", family: 4 }];
    },
    request: async (...args) => {
      requestCall = args;
      return { statusCode: 200, body: "ok" };
    },
  }));

  assert.equal(result.state, "available");
  assert.equal(result.statusCode, 200);
  assert.equal(lookupCall[0], "api.surplasse.test");
  assert.deepEqual(lookupCall[1], { all: true, verbatim: true });
  assert.equal(requestCall[0].href, "https://api.surplasse.test/health");
  assert.equal(requestCall[1].rejectUnauthorized, true);
  assert.ok(Buffer.isBuffer(requestCall[1].expectedCertificateRaw));
  assert.deepEqual(requestCall[1].certificateAuthorities, [VALID_CERTIFICATE]);
});

test("public HTTPS probe handles missing and invalid local certificates without connecting", async () => {
  let requests = 0;
  const missing = await probePublicUrl(health(), probeOptions({
    readCertificate: async () => {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    },
    request: async () => {
      requests += 1;
    },
  }));
  const invalid = await probePublicUrl(health(), probeOptions({
    readCertificate: async () => Buffer.from("not a PEM certificate"),
    request: async () => {
      requests += 1;
    },
  }));
  const oversized = await probePublicUrl(health(), probeOptions({
    readCertificate: async () => Buffer.alloc(65_537),
    request: async () => {
      requests += 1;
    },
  }));

  assert.equal(missing.state, "certificate-missing");
  assert.equal(invalid.state, "certificate-error");
  assert.equal(oversized.state, "certificate-error");
  assert.equal(requests, 0);
});

test("public HTTPS probe refuses failed, empty, mixed or non-loopback DNS answers", async () => {
  const cases = [
    [async () => {
      const error = new Error("not found");
      error.code = "ENOTFOUND";
      throw error;
    }, "dns-error"],
    [async () => [], "dns-error"],
    [async () => [{ address: "192.0.2.10", family: 4 }], "dns-misdirected"],
    [async () => [
      { address: "127.0.0.1", family: 4 },
      { address: "::1", family: 6 },
    ], "dns-misdirected"],
  ];
  for (const [lookup, expectedState] of cases) {
    let requests = 0;
    const result = await probePublicUrl(health(), probeOptions({
      lookup,
      request: async () => {
        requests += 1;
      },
    }));
    assert.equal(result.state, expectedState);
    assert.equal(requests, 0);
  }
});

test("public HTTPS probe refuses non-HTTPS, foreign and custom-port targets", async () => {
  const targets = [
    "http://api.surplasse.test/health",
    "https://api.surplasse.test:8443/health",
    "https://surplasse.test.evil.example/health",
    "https://user@api.surplasse.test/health",
  ];
  for (const url of targets) {
    let lookups = 0;
    const result = await probePublicUrl(health({ url }), probeOptions({
      lookup: async () => {
        lookups += 1;
        return [{ address: "127.0.0.1", family: 4 }];
      },
    }));
    assert.equal(result.state, "misconfigured", url);
    assert.equal(lookups, 0, url);
  }
});

test("public HTTPS probe classifies TLS, certificate, proxy and timeout failures safely", async () => {
  const cases = [
    ["CERTIFICATE_MISMATCH", "certificate-mismatch"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "tls-error"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "tls-error"],
    ["ECONNREFUSED", "proxy-error"],
    ["ETIMEDOUT", "timeout"],
  ];
  for (const [code, expectedState] of cases) {
    const result = await probePublicUrl(health(), probeOptions({
      request: async () => {
        const error = new Error("raw transport details must stay private");
        error.code = code;
        throw error;
      },
    }));
    assert.equal(result.state, expectedState);
    assert.equal(result.detail.includes("raw transport"), false);
  }
});

test("public HTTPS probe distinguishes available, gateway, reserved and redirect responses", async () => {
  const available = await responseProbe(health(), 200);
  const badGateway = await responseProbe(health(), 502);
  const unavailable = await responseProbe(health(), 503);
  const reserved = await responseProbe(
    health({ expectedStatusCodes: [503], expectation: "reserved" }),
    503,
  );
  const wrongReserved = await responseProbe(
    health({ expectedStatusCodes: [503], expectation: "reserved" }),
    200,
  );
  const redirect = await responseProbe(
    health({
      url: "https://www.surplasse.test/",
      expectedStatusCodes: [308],
      expectation: "redirect",
    }),
    308,
  );

  assert.equal(available.state, "available");
  assert.equal(badGateway.state, "gateway-error");
  assert.equal(unavailable.state, "gateway-error");
  assert.equal(reserved.state, "reserved");
  assert.equal(wrongReserved.state, "http-error");
  assert.equal(redirect.state, "redirect");
});

test("Backend public health requires a valid UP JSON response", async () => {
  const backendHealth = health({ bodyExpectation: "quarkus-up" });
  const up = await responseProbe(backendHealth, 200, '{"status":"UP"}');
  const down = await responseProbe(backendHealth, 200, '{"status":"DOWN"}');
  const invalid = await responseProbe(backendHealth, 200, "not-json");

  assert.equal(up.state, "available");
  assert.equal(down.state, "http-error");
  assert.equal(invalid.state, "http-error");
});

test("public probe factory deduplicates concurrent checks for one URL", async () => {
  let requestCount = 0;
  let release;
  const requestPending = new Promise((resolve) => {
    release = resolve;
  });
  const probe = createPublicUrlProbe(probeOptions({
    request: async () => {
      requestCount += 1;
      await requestPending;
      return { statusCode: 200, body: "ok" };
    },
  }));

  const first = probe(health());
  const second = probe(health());
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(requestCount, 1);
  assert.deepEqual(firstResult, secondResult);
});

function health(overrides = {}) {
  return {
    url: "https://api.surplasse.test/health",
    timeoutMs: 1_500,
    expectedStatusCodes: [200],
    expectation: "available",
    bodyExpectation: null,
    ...overrides,
  };
}

function probeOptions(overrides = {}) {
  return {
    baseDomain: "surplasse.test",
    certificateFile: "/private/certificate.pem",
    certificateAuthorities: [VALID_CERTIFICATE],
    readCertificate: async () => Buffer.from(VALID_CERTIFICATE),
    lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    request: async () => ({ statusCode: 200, body: "ok" }),
    ...overrides,
  };
}

async function responseProbe(probeHealth, statusCode, body = "ok") {
  return probePublicUrl(probeHealth, probeOptions({
    request: async () => ({ statusCode, body }),
  }));
}
