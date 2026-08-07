import { corsHeaders } from "../_shared/cors.ts";

// The QuickBooks Online waitlist form posts here rather than straight to
// listmonk, for two reasons:
//
//   1. listmonk's public subscription endpoint binds only email, name, and
//      list UUIDs (cmd/public.go, processSubForm). Anything else in the body is
//      silently dropped, so the practice name and the answers about client
//      count, sales documents, and getting started would never be stored.
//      Attributes are only reachable through the authenticated admin API.
//   2. listmonk sends no CORS headers, so browser JavaScript cannot read its
//      response and could not tell a success from a failure.
//
// So the form's extra answers are stored as listmonk subscriber attributes,
// which are queryable and segmentable, and the admin credentials stay here.

const LISTMONK_URL = Deno.env.get("LISTMONK_API_URL") ?? "";
const LISTMONK_USER = Deno.env.get("LISTMONK_API_USER") ?? "";
const LISTMONK_TOKEN = Deno.env.get("LISTMONK_API_TOKEN") ?? "";
// The admin API takes lists by numeric ID, not by the UUID the public
// subscription endpoint uses, so the two are easy to confuse.
const LISTMONK_LIST_ID_RAW = Deno.env.get("LISTMONK_QBO_LIST_ID") ?? "";
const LISTMONK_LIST_ID = Number(LISTMONK_LIST_ID_RAW);

/** Names the misconfigured variables, never their values, for the logs. */
function configProblems(): string[] {
  const problems: string[] = [];
  if (!LISTMONK_URL) problems.push("LISTMONK_API_URL is missing");
  if (!LISTMONK_USER) problems.push("LISTMONK_API_USER is missing");
  if (!LISTMONK_TOKEN) problems.push("LISTMONK_API_TOKEN is missing");
  if (!LISTMONK_LIST_ID_RAW) {
    problems.push("LISTMONK_QBO_LIST_ID is missing");
  } else if (!Number.isInteger(LISTMONK_LIST_ID) || LISTMONK_LIST_ID <= 0) {
    problems.push(
      "LISTMONK_QBO_LIST_ID must be the list's numeric ID, not its UUID",
    );
  }
  return problems;
}

// The answers the form offers. Anything else is discarded rather than stored,
// so a hand-crafted request cannot write arbitrary values onto a subscriber
// record.
const CLIENT_COUNTS = ["1 to 5", "6 to 15", "16 to 50", "51 or more"];
const SALES_DOCUMENTS = [
  "Yes, for most clients",
  "Yes, for some clients",
  "No, purchases only",
  "Not sure",
];
// The radio group's values rather than its labels, so the stored answer
// survives a rewording of the options on the page.
const START_PREFERENCES = ["early", "listed"];

const MAX_TEXT_LENGTH = 200;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const listmonk = (path: string, init: RequestInit = {}) =>
  fetch(`${LISTMONK_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${LISTMONK_USER}:${LISTMONK_TOKEN}`)}`,
    },
  });

/**
 * Find an existing subscriber by exact email, or null.
 *
 * Listmonk's `query` parameter takes raw SQL and needs the
 * `subscribers:sql_query` permission, which grants arbitrary SQL against the
 * subscriber table. A public form endpoint should not hold that. `search`
 * needs only `subscribers:get`, but it is a case-insensitive regex match
 * across both name and email, so the term is regex-escaped and the results are
 * narrowed to an exact address here.
 *
 * `subscribers:get_all` is also required: without it the search is scoped to
 * the lists this API user can see, and someone who is only on the newsletter
 * list would come back as new.
 */
async function findSubscriberId(email: string): Promise<number | null> {
  // SHORTCUT: scans the first 100 matches, which only fills up if other
  // addresses contain this one as a substring. If a known address is ever
  // reported as new, paginate.
  const term = encodeURIComponent(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const response = await listmonk(
    `/api/subscribers?search=${term}&per_page=100`,
  );
  if (!response.ok) {
    throw new Error(`listmonk subscriber lookup failed: ${response.status}`);
  }

  const body = await response.json();
  const results: { id?: number; email?: string }[] = body?.data?.results ?? [];

  // A substring match is not an identity match, so pick the exact address.
  const match = results.find((s) => (s.email ?? "").toLowerCase() === email);
  return match?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const problems = configProblems();
  if (problems.length > 0) {
    console.error(`Listmonk configuration: ${problems.join("; ")}`);
    return json({ error: "Waitlist is not configured" }, 500);
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ error: "Invalid request body" }, 400);
    }

    const email = String(payload.email ?? "")
      .trim()
      .toLowerCase();
    // Deliberately permissive: listmonk sanitises and rejects properly, this
    // only keeps obvious rubbish out of the lookup and the stored record.
    if (!/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email) || email.length > 320) {
      return json({ error: "A valid email address is required" }, 400);
    }

    // The form marks both required, so enforce it here too rather than
    // trusting the browser.
    const name = String(payload.name ?? "")
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    if (!name) {
      return json({ error: "A name is required" }, 400);
    }

    const practice = String(payload.practice ?? "")
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    if (!practice) {
      return json({ error: "A practice name is required" }, 400);
    }

    // The form marks this one required too, and the browser cannot submit
    // without it, so a request arriving without a valid answer did not come
    // from the form.
    const startPreference = START_PREFERENCES.includes(payload.startPreference)
      ? payload.startPreference
      : null;
    if (!startPreference) {
      return json({ error: "A start preference is required" }, 400);
    }

    const clientCount = CLIENT_COUNTS.includes(payload.clientCount)
      ? payload.clientCount
      : null;
    const salesDocuments = SALES_DOCUMENTS.includes(payload.salesDocuments)
      ? payload.salesDocuments
      : null;

    const attribs = {
      quickbooks_waitlist: {
        practice,
        client_count: clientCount,
        sales_documents: salesDocuments,
        start_preference: startPreference,
      },
    };

    const existingId = await findSubscriberId(email);

    if (existingId === null) {
      // preconfirm_subscriptions stays false so a double opt-in list sends the
      // confirmation email the success message tells people to look for.
      const created = await listmonk("/api/subscribers", {
        method: "POST",
        body: JSON.stringify({
          email,
          name,
          status: "enabled",
          lists: [LISTMONK_LIST_ID],
          attribs,
          preconfirm_subscriptions: false,
        }),
      });

      if (!created.ok) {
        throw new Error(`listmonk subscriber create failed: ${created.status}`);
      }

      return json({ ok: true }, 200);
    }

    // Already known to listmonk, most likely from the newsletter list. PATCH
    // merges attributes and, with `lists` omitted, leaves their other
    // subscriptions alone; PUT would clear them. The name is refreshed from
    // what they just typed, which is more current than whatever is on record.
    const patched = await listmonk(`/api/subscribers/${existingId}`, {
      method: "PATCH",
      body: JSON.stringify({ name, attribs }),
    });

    if (!patched.ok) {
      throw new Error(`listmonk subscriber update failed: ${patched.status}`);
    }

    const listed = await listmonk("/api/subscribers/lists", {
      method: "PUT",
      body: JSON.stringify({
        ids: [existingId],
        action: "add",
        target_list_ids: [LISTMONK_LIST_ID],
        status: "unconfirmed",
      }),
    });

    if (!listed.ok) {
      throw new Error(`listmonk list add failed: ${listed.status}`);
    }

    // Adding to a list directly does not send the opt-in email, so ask for it.
    const optin = await listmonk(`/api/subscribers/${existingId}/optin`, {
      method: "POST",
      body: "{}",
    });

    if (!optin.ok) {
      throw new Error(`listmonk opt-in email failed: ${optin.status}`);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("QuickBooks waitlist error:", error);
    return json({ error: "Could not add you to the waitlist" }, 500);
  }
});
