/**
 * The one finding shape every check emits (KTD2 in the website content system
 * plan). Later tools parse the JSON report, never stdout, so changing a field
 * here means bumping `REPORT_SCHEMA_VERSION` in `report.mjs`.
 *
 * @typedef {"block" | "warn"} Severity
 *
 * @typedef {object} Finding
 * @property {string} check        Which check produced it, e.g. "seo", "a11y".
 * @property {string} rule         Stable rule ID, e.g. "h1-count", "image-alt".
 * @property {Severity} severity
 * @property {string} route        Canonical route, e.g. "/capture/".
 * @property {string} distFile     Built file, relative to the repo root.
 * @property {string} source       Best-guess source file, or "unknown".
 * @property {string | null} selector  CSS selector of the element, if any.
 * @property {string | null} snippet   Short HTML excerpt, if any.
 * @property {string} message      What is wrong, readable without the rule docs.
 * @property {string | null} helpUrl
 * @property {string | null} component  A real component root from
 *   `componentRoots` in the config, when the element sits under one.
 * @property {string | null} group  A cross-page group the check forms itself,
 *   e.g. every page sharing one title ("title:<the title>"). Only findings
 *   with a component or a group merge across pages.
 *
 * A merged finding is a Finding whose `routes` lists every page it occurs on
 * (a page finding has `routes: [route]`).
 * @typedef {Finding & { routes: string[] }} MergedFinding
 */

export const SEVERITIES = ["block", "warn"];

const REQUIRED_STRINGS = ["check", "rule", "route", "distFile", "message"];

/**
 * Builds a finding, filling optional fields with explicit nulls so every
 * report has the same keys.
 *
 * @param {Partial<Finding> & Pick<Finding, "check" | "rule" | "severity" | "route" | "distFile" | "message">} fields
 * @returns {Finding}
 */
export function createFinding(fields) {
  const finding = {
    check: fields.check,
    rule: fields.rule,
    severity: fields.severity,
    route: fields.route,
    distFile: fields.distFile,
    source: fields.source ?? "unknown",
    selector: fields.selector ?? null,
    snippet: fields.snippet ?? null,
    message: fields.message,
    helpUrl: fields.helpUrl ?? null,
    component: fields.component ?? null,
    group: fields.group ?? null,
  };
  const problems = validateFinding(finding);
  if (problems.length > 0) {
    throw new Error(`Invalid finding: ${problems.join("; ")}`);
  }
  return finding;
}

/**
 * @param {unknown} finding
 * @returns {string[]} Problems, empty when valid.
 */
export function validateFinding(finding) {
  if (typeof finding !== "object" || finding === null) return ["not an object"];
  const f = /** @type {Record<string, unknown>} */ (finding);
  const problems = [];
  for (const key of REQUIRED_STRINGS) {
    if (typeof f[key] !== "string" || f[key] === "") {
      problems.push(`${key} must be a non-empty string`);
    }
  }
  if (!SEVERITIES.includes(/** @type {string} */ (f.severity))) {
    problems.push(`severity must be one of ${SEVERITIES.join(", ")}`);
  }
  if (typeof f.source !== "string") problems.push("source must be a string");
  for (const key of ["selector", "snippet", "helpUrl", "component", "group"]) {
    if (f[key] !== null && typeof f[key] !== "string") {
      problems.push(`${key} must be a string or null`);
    }
  }
  return problems;
}

/**
 * Finds the component root an element sits under. Works with anything that
 * has a DOM-style `closest(selector)`: a browser Element, or a cheerio
 * selection wrapped as `(sel) => $(el).closest(sel).length > 0`.
 *
 * @param {(selector: string) => boolean} isInside
 * @param {import("./config.mjs").ComponentRoot[]} roots
 * @returns {import("./config.mjs").ComponentRoot | null}
 */
export function componentFor(isInside, roots) {
  return roots.find((root) => isInside(root.selector)) ?? null;
}

/**
 * Merges the same component or group finding across pages. Findings merge
 * only when they carry a component or a group and match on check, rule,
 * component, group and selector; a matching selector alone is not enough,
 * since `main > h1` on two pages is two separate problems. Everything else
 * stays a page finding.
 *
 * @param {Finding[]} findings
 * @returns {MergedFinding[]}
 */
export function mergeFindings(findings) {
  /** @type {Map<string, MergedFinding>} */
  const merged = new Map();
  /** @type {MergedFinding[]} */
  const result = [];
  for (const finding of findings) {
    if (finding.component === null && finding.group === null) {
      result.push({ ...finding, routes: [finding.route] });
      continue;
    }
    const key = JSON.stringify([
      finding.check,
      finding.rule,
      finding.component,
      finding.group,
      finding.selector,
    ]);
    const existing = merged.get(key);
    if (existing) {
      if (!existing.routes.includes(finding.route)) {
        existing.routes.push(finding.route);
      }
      continue;
    }
    const entry = { ...finding, routes: [finding.route] };
    merged.set(key, entry);
    result.push(entry);
  }
  for (const entry of merged.values()) entry.routes.sort();
  return result;
}
