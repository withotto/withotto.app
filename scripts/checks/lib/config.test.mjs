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

  it("surfaces a missing import inside an existing config as itself", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    try {
      fs.writeFileSync(
        path.join(dir, "checks.config.mjs"),
        'import "./missing-helper.mjs";\nexport default {};\n',
      );
      await assert.rejects(
        loadConfig(dir),
        (error) =>
          /** @type {any} */ (error).code === "ERR_MODULE_NOT_FOUND" &&
          /missing-helper\.mjs/.test(/** @type {Error} */ (error).message),
      );
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

  it("accepts a config without claimAge and rejects a malformed one", async () => {
    const { default: good } = await import(
      path.join(repoRoot, "checks.config.mjs")
    );
    const { claimAge, ...without } = good;
    assert.deepEqual(claimAge, { warnDays: 45, blockDays: 90 });
    assert.deepEqual(validateConfig(without), []);
    for (const bad of [
      { warnDays: 0, blockDays: 90 },
      { warnDays: 45, blockDays: 90.5 },
      { warnDays: "45", blockDays: 90 },
      { warnDays: 90, blockDays: 90 },
      { blockDays: 90 },
      null,
    ]) {
      assert.deepEqual(
        validateConfig({ ...without, claimAge: bad }),
        [
          "claimAge must be { warnDays, blockDays }, positive whole numbers of days with warnDays below blockDays",
        ],
        JSON.stringify(bad),
      );
    }
  });

  it("accepts a config without repoUrl and rejects one that isn't a GitHub repo", async () => {
    const { default: good } = await import(
      path.join(repoRoot, "checks.config.mjs")
    );
    const { repoUrl, ...without } = good;
    assert.equal(repoUrl, "https://github.com/withotto/withotto.app");
    assert.deepEqual(validateConfig(without), []);
    for (const bad of [
      "",
      "https://github.com/withotto/withotto.app/",
      "https://gitlab.com/withotto/withotto.app",
      "https://github.com/withotto/withotto.app?tab=readme",
      "https://github.com/withotto/withotto.app#readme",
      42,
    ]) {
      assert.deepEqual(
        validateConfig({ ...without, repoUrl: bad }),
        [
          'repoUrl must be a GitHub repository URL with no trailing slash, query or fragment, e.g. "https://github.com/owner/repo"',
        ],
        JSON.stringify(bad),
      );
    }
  });
});
