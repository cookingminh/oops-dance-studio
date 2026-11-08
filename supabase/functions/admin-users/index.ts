// admin-users entrypoint: CORS + environment around handler.ts (api-contract §6).
//
// Secrets (supabase secrets set …):
//   DEMO_MODE        "true" on the public demo: demo accounts cannot be re-emailed or deleted
//   ALLOWED_ORIGINS  comma-separated frontend origins; unset = "*" (localhost:5173 is always allowed)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, handleRequest, isEnabled, parseAllowedOrigins } from "./handler.ts";

const allowedOrigins = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));
const demoMode = isEnabled(Deno.env.get("DEMO_MODE"));

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"), allowedOrigins);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const response = await handleRequest(req, { admin, demoMode });
  for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
  return response;
});
