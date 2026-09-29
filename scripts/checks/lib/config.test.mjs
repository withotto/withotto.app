import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig, validateConfig } from "./config.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("loadConfig", () => {
  it("loads the repo's own config", async () => {
    const config = await loadConfig(repoRoot);
    assert.ok(config.blockedHosts.includes("chat.withotto.app"));
    assert.equal(config.abs("dist"), path.join(repoRoot, "dist"));
  });

  it("names the missing file clearly", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    try {
      await assert.rejects(loadConfig(dir), /No checks\.config\.mjs in/);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it("rejects a config with a misspelled key", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    try {
      const { default: good } = await import(
        path.join(repoRoot, "checks.config.mjs")
      );
      const { blockedHosts, ...rest } = good;
      fs.writeFileSync(
        path.join(dir, "checks.config.mjs"),
        `export default ${JSON.stringify({ ...rest, blockedHost: blockedHosts })};\n`,
      );
      await assert.rejects(loadConfig(dir), /blockedHosts must be an array/);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

describe("validateConfig", () => {
  it("accepts the repo's config and rejects a named export", async () => {
    const { default: good } = await import(
      path.join(repoRoot, "checks.config.mjs")
    );
    assert.deepEqual(validateConfig(good), []);
    assert.match(validateConfig(undefined)[0], /export default/);
  });
});
