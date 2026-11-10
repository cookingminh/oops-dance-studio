// bank-webhook entrypoint (api-contract §6). See handler.ts.
//
// Secret (supabase secrets set …):
//   BANK_WEBHOOK_KEY  the API key configured in SePay's webhook ("Apikey" authentication)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// No CORS: banks call it server to server.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { handleRequest } from "./handler.ts";

Deno.serve((req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return handleRequest(req, { admin, apiKey: Deno.env.get("BANK_WEBHOOK_KEY") });
});
