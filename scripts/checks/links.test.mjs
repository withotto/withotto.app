import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remapArgs } from "./links.mjs";

describe("remapArgs", () => {
  const args = remapArgs("https://example.test", "/work/My Site/dist");

  it("points the site's own pages at the build, not production", () => {
    assert.ok(
      args.includes(
        "^https://example\\.test/(.*)$ file:///work/My%20Site/dist/$1",
      ),
    );
  });

  it("maps /404/ to the built 404.html before the general rule", () => {
    const special = args.indexOf(
      "^https://example\\.test/404/$ file:///work/My%20Site/dist/404.html",
    );
    const general = args.indexOf(
      "^https://example\\.test/(.*)$ file:///work/My%20Site/dist/$1",
    );
    assert.ok(special !== -1 && special < general);
  });

  it("passes each rule after its own --remap flag", () => {
    assert.deepEqual(
      args.filter((_, i) => i % 2 === 0),
      ["--remap", "--remap"],
    );
  });
});
