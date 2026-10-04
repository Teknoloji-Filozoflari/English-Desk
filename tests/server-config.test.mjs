import test from "node:test";
import assert from "node:assert/strict";
import {
  createRequestPolicy,
  serverConfig,
} from "../scripts/server-config.mjs";
test("desktop server defaults remain loopback-only and invalid environment values fail early", () => {
  assert.deepEqual(serverConfig({}), {
    port: 8081,
    bind: "127.0.0.1",
    origins: ["http://127.0.0.1:8081"],
  });
  for (const env of [
    { ENGLISH_DESK_LISTEN_PORT: "0" },
    { ENGLISH_DESK_LISTEN_PORT: "abc" },
    { ENGLISH_DESK_PUBLIC_ORIGINS: "http://example.com/path" },
    { ENGLISH_DESK_PUBLIC_ORIGINS: "http://user:pass@example.com" },
  ])
    assert.throws(() => serverConfig(env));
});
test("Docker allows exact configured hosts and matching browser origins at custom mapped ports", () => {
  const allowed = createRequestPolicy([
    "http://127.0.0.1:8091",
    "http://localhost:8091",
  ]);
  for (const host of ["127.0.0.1:8091", "localhost:8091"]) {
    assert.ok(allowed({ headers: { host } }));
    assert.ok(allowed({ headers: { host, origin: "http://" + host } }));
  }
  for (const headers of [
    { host: "evil.test:8091" },
    { host: "localhost:8081" },
    { host: "localhost:8091", origin: "http://evil.test:8091" },
    { host: "localhost:8091", origin: "http://127.0.0.1:8091" },
    { host: "localhost:8091", origin: "null" },
  ])
    assert.equal(allowed({ headers }), false);
});
