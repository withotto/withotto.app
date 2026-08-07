export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  // A JSON POST triggers a preflight, which fails unless the allowed methods
  // come back with it. GET-only functions never see one.
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
