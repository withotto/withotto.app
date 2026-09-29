import fs from "node:fs";
import * as prettier from "prettier";

/**
 * The committed baseline of existing block-severity debt. Only findings beyond
 * it block.
 *
 * - Component findings are keyed by check, rule and component, so a new page
 *   inheriting a baselined layout issue does not block.
 * - Group findings (pages the check itself grouped, e.g. by a shared title)
 *   are keyed by check, rule and group, so fixing one page never re-keys the
 *   rest of the group.
 * - Page findings are keyed by check, rule and route.
 * - Each entry carries a count; more findings than that for the key block.
 *   A group finding counts once per page in it, so a page joining a
 *   baselined group is new debt, and a page leaving it lets prune shrink the
 *   count.
 * - Warnings are never baselined, since they never fail a run.
 * - The file holds rule IDs, routes, component names and group names only.
 *
 * Removing entries (prune) needs no approval, since it only shrinks the
 * baseline. Adding or re-keying entries needs Stuart's approval in review.
 *
 * @typedef {object} BaselineEntry
 * @property {string} check
 * @property {string} rule
 * @property {string} [component]
 * @property {string} [group]
 * @property {string} [route]
 * @property {number} count
 *
 * @typedef {object} Baseline
 * @property {1} schemaVersion
 * @property {BaselineEntry[]} entries
 */

export const BASELINE_SCHEMA_VERSION = 1;

export class BaselineError extends Error {}

/**
 * The key a finding or entry is counted under. A component takes precedence
 * over a group if a finding ever carries both; the route counts only when it
 * has neither.
 *
 * @param {{ check: string, rule: string, component?: string | null, group?: string | null, route?: string }} item
 */
export function baselineKey(item) {
  if (item.component) {
    return JSON.stringify(["component", item.check, item.rule, item.component]);
  }
  if (item.group) {
    return JSON.stringify(["group", item.check, item.rule, item.group]);
  }
  return JSON.stringify(["page", item.check, item.rule, item.route]);
}

/**
 * How much a finding counts towards its key: the number of pages for a group
 * finding, else 1.
 *
 * @param {import("./findings.mjs").MergedFinding} finding
 */
function weight(finding) {
  return !finding.component && finding.group ? finding.routes.length : 1;
}

/**
 * @param {unknown} data
 * @returns {Baseline}
 */
export function parseBaseline(data) {
  const fail = (/** @type {string} */ why) => {
    throw new BaselineError(`Malformed baseline: ${why}`);
  };
  if (typeof data !== "object" || data === null) fail("not a JSON object");
  const b = /** @type {Record<string, unknown>} */ (data);
  if (b.schemaVersion !== BASELINE_SCHEMA_VERSION) {
    fail(`schemaVersion must be ${BASELINE_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(b.entries)) fail('"entries" must be an array');
  const seen = new Set();
  /** @type {any[]} */ (b.entries).forEach((entry, i) => {
    const at = `entries[${i}]`;
    if (typeof entry !== "object" || entry === null)
      fail(`${at} not an object`);
    for (const key of ["check", "rule"]) {
      if (typeof entry[key] !== "string" || entry[key] === "") {
        fail(`${at}.${key} must be a non-empty string`);
      }
    }
    const locations = ["component", "group", "route"].filter((k) =>
      Object.hasOwn(entry, k),
    );
    for (const key of locations) {
      if (typeof entry[key] !== "string" || entry[key] === "") {
        fail(`${at}.${key} must be a non-empty string`);
      }
    }
    if (locations.length !== 1) {
      fail(`${at} needs exactly one of "component", "group" or "route"`);
    }
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      fail(`${at}.count must be a positive integer`);
    }
    const extra = Object.keys(entry).filter(
      (k) =>
        !["check", "rule", "component", "group", "route", "count"].includes(k),
    );
    if (extra.length > 0)
      fail(`${at} has unexpected keys: ${extra.join(", ")}`);
    const key = baselineKey(entry);
    if (seen.has(key)) fail(`${at} duplicates an earlier entry`);
    seen.add(key);
  });
  return /** @type {Baseline} */ (b);
}

/**
 * @param {string} file
 * @returns {Baseline} An empty baseline when the file does not exist yet.
 */
export function readBaseline(file) {
  if (!fs.existsSync(file)) {
    return { schemaVersion: BASELINE_SCHEMA_VERSION, entries: [] };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new BaselineError(
      `Malformed baseline: ${file} is not valid JSON (${/** @type {Error} */ (error).message})`,
    );
  }
  return parseBaseline(data);
}

/**
 * Writes the baseline already formatted, so `format:check` stays clean.
 *
 * @param {string} file
 * @param {Baseline} baseline
 */
export async function writeBaseline(file, baseline) {
  const sorted = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    entries: [...baseline.entries].sort((a, b) =>
      baselineKey(a).localeCompare(baselineKey(b)),
    ),
  };
  const options = (await prettier.resolveConfig(file)) ?? {};
  const text = await prettier.format(JSON.stringify(sorted), {
    ...options,
    filepath: file,
  });
  fs.writeFileSync(file, text);
}

/**
 * Applies the baseline to merged findings.
 *
 * Every finding gets a `status`: "new" (a block finding beyond the baseline),
 * "baselined" or "warn". When a key has more findings than its baseline
 * count (a group finding counting once per page), all of that key's findings
 * are "new", because there is no telling which one is the addition.
 *
 * `stale` lists what prune would change: entries no finding matches any more,
 * and entries whose count has fallen. Only keys the run could have seen are
 * considered, so a filtered or single-check run never prunes the rest.
 *
 * @param {import("./findings.mjs").MergedFinding[]} findings
 * @param {Baseline} baseline
 * @param {object} scope
 * @param {string[]} scope.checks Checks that ran.
 * @param {boolean} scope.complete False when a page filter limited the run.
 */
export function applyBaseline(findings, baseline, { checks, complete }) {
  /** @type {Map<string, { findings: import("./findings.mjs").MergedFinding[], count: number }>} */
  const byKey = new Map();
  for (const finding of findings) {
    if (finding.severity !== "block") continue;
    const key = baselineKey(finding);
    let tally = byKey.get(key);
    if (!tally) byKey.set(key, (tally = { findings: [], count: 0 }));
    tally.findings.push(finding);
    tally.count += weight(finding);
  }
  const allowed = new Map(
    baseline.entries.map((entry) => [baselineKey(entry), entry.count]),
  );

  /** @type {Map<object, "new" | "baselined" | "warn">} */
  const status = new Map();
  for (const finding of findings) {
    if (finding.severity === "warn") status.set(finding, "warn");
  }
  for (const [key, tally] of byKey) {
    const within = tally.count <= (allowed.get(key) ?? 0);
    for (const finding of tally.findings)
      status.set(finding, within ? "baselined" : "new");
  }

  const stale = complete
    ? baseline.entries
        .filter((entry) => checks.includes(entry.check))
        .flatMap((entry) => {
          const found = byKey.get(baselineKey(entry))?.count ?? 0;
          return found < entry.count ? [{ ...entry, found }] : [];
        })
    : [];

  return {
    findings: findings.map((finding) => ({
      ...finding,
      status: /** @type {"new" | "baselined" | "warn"} */ (status.get(finding)),
    })),
    stale,
  };
}

/**
 * Removes or shrinks the stale entries `applyBaseline` reported.
 *
 * @param {Baseline} baseline
 * @param {Array<BaselineEntry & { found: number }>} stale
 * @returns {Baseline}
 */
export function pruneBaseline(baseline, stale) {
  const found = new Map(
    stale.map((entry) => [baselineKey(entry), entry.found]),
  );
  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    entries: baseline.entries.flatMap((entry) => {
      const key = baselineKey(entry);
      if (!found.has(key)) return [entry];
      const count = /** @type {number} */ (found.get(key));
      return count === 0 ? [] : [{ ...entry, count }];
    }),
  };
}

/**
 * Builds baseline entries covering every block finding. Used to create the
 * initial baseline and to accept new debt, both of which Stuart approves.
 *
 * @param {import("./findings.mjs").MergedFinding[]} findings
 * @returns {BaselineEntry[]}
 */
export function entriesFor(findings) {
  /** @type {Map<string, BaselineEntry>} */
  const entries = new Map();
  for (const finding of findings) {
    if (finding.severity !== "block") continue;
    const key = baselineKey(finding);
    const existing = entries.get(key);
    if (existing) {
      existing.count += weight(finding);
      continue;
    }
    const { check, rule } = finding;
    const location = finding.component
      ? { component: finding.component }
      : finding.group
        ? { group: finding.group }
        : { route: finding.route };
    entries.set(key, { check, rule, ...location, count: weight(finding) });
  }
  return [...entries.values()];
}
