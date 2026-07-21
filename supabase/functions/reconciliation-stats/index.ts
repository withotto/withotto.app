import { createClient } from "jsr:@supabase/supabase-js@2.110.7";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        db: {
          schema: "api",
        },
      },
    );

    const { data, error } = await supabaseClient
      .from("website_summary_stats")
      .select("*")
      .single();

    if (error) {
      console.error("Database query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch statistics" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const cacheMinutes = 30;
    return new Response(
      JSON.stringify({
        bank_rule: data.bank_rule,
        smart_match: data.smart_match,
        error_rate_percentage: data.error_rate_percentage,
        // last_updated reflects when the materialized view was refreshed, so the
        // "last updated" detail shows data freshness rather than request time.
        timestamp: data.last_updated ?? new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${cacheMinutes * 60}`,
        },
      },
    );
  } catch (error) {
    console.error("Server error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
