// Unit tests for handler.ts with an in-memory stand-in for the service-role client.
// No Supabase stack needed:
//   deno test --config supabase/functions/admin-users/deno.json supabase/functions/admin-users/
// deno-lint-ignore-file no-explicit-any

import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders, handleRequest, isDemoAccount, isEnabled, parseAllowedOrigins } from "./handler.ts";

const ADMIN = "a0000000-0000-4000-8000-000000000001";
const DEMO_GUEST = "a0000000-0000-4000-8000-000000000002";
const VISITOR = "a0000000-0000-4000-8000-000000000003";

const PROFILES: Record<string, { id: string; role: string; email: string }> = {
  [ADMIN]: { id: ADMIN, role: "admin", email: "admin@demo.oopsdance.test" },
  [DEMO_GUEST]: { id: DEMO_GUEST, role: "guest", email: "guest@demo.oopsdance.test" },
  [VISITOR]: { id: VISITOR, role: "guest", email: "visitor@example.com" },
};

// Just enough of supabase-js for update/delete: profile lookups by id, and count
// queries that report nothing still references the user.
function fakeAdmin() {
  const calls: string[] = [];
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      neq: () => query,
      maybeSingle: () =>
        Promise.resolve({ data: table === "profiles" ? PROFILES[filters.id as string] ?? null : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ count: 0, error: null }),
    };
    return query;
  };
  const admin = {
    from,
    auth: {
      getUser: (token: string) =>
        Promise.resolve(token === "admin-token"
          ? { data: { user: { id: ADMIN } }, error: null }
          : { data: { user: null }, error: { message: "invalid JWT" } }),
      admin: {
        updateUserById: (id: string) => {
          calls.push(`update ${id}`);
          return Promise.resolve({ error: null });
        },
        deleteUser: (id: string) => {
          calls.push(`delete ${id}`);
          return Promise.resolve({ error: null });
        },
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

const post = (body: unknown, token = "admin-token") =>
  new Request("http://localhost/functions/v1/admin-users", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function call(body: unknown, demoMode: boolean, token?: string) {
  const { admin, calls } = fakeAdmin();
  const res = await handleRequest(post(body, token), { admin, demoMode });
  return { status: res.status, body: await res.json(), calls };
}

Deno.test("DEMO_MODE: update on a demo account is 403 FORBIDDEN: demo account", async () => {
  const res = await call({ action: "update", user_id: DEMO_GUEST, email: "taken@over.test" }, true);
  assertEquals(res.status, 403);
  assertEquals(res.body, { error: "FORBIDDEN: demo account", code: "FORBIDDEN" });
  assertEquals(res.calls, []);
});

Deno.test("DEMO_MODE: delete on a demo account is 403 FORBIDDEN: demo account", async () => {
  const res = await call({ action: "delete", user_id: DEMO_GUEST }, true);
  assertEquals(res.status, 403);
  assertEquals(res.body, { error: "FORBIDDEN: demo account", code: "FORBIDDEN" });
  assertEquals(res.calls, []);
});

Deno.test("DEMO_MODE: accounts created by visitors can still be re-emailed and deleted", async () => {
  const update = await call({ action: "update", user_id: VISITOR, email: "new@example.com" }, true);
  assertEquals(update.status, 200);
  assertEquals(update.calls, [`update ${VISITOR}`]);
  const del = await call({ action: "delete", user_id: VISITOR }, true);
  assertEquals(del.status, 200);
  assertEquals(del.calls, [`delete ${VISITOR}`]);
});

Deno.test("without DEMO_MODE, demo accounts are ordinary accounts", async () => {
  const update = await call({ action: "update", user_id: DEMO_GUEST, email: "new@example.com" }, false);
  assertEquals(update.status, 200);
  const del = await call({ action: "delete", user_id: DEMO_GUEST }, false);
  assertEquals(del.status, 200);
  assertEquals(del.body, { ok: true, user_id: DEMO_GUEST });
});

Deno.test("an invalid token is 401 FORBIDDEN", async () => {
  const res = await call({ action: "delete", user_id: VISITOR }, true, "not-a-jwt");
  assertEquals(res.status, 401);
  assertEquals(res.body.code, "FORBIDDEN");
});

Deno.test("flag and demo-domain helpers", () => {
  for (const on of ["true", "TRUE", "1", "yes"]) assertEquals(isEnabled(on), true);
  for (const off of [undefined, "", "false", "0"]) assertEquals(isEnabled(off), false);
  assertEquals(isDemoAccount("Guest@Demo.OopsDance.test"), true);
  assertEquals(isDemoAccount("guest@demo.oopsdance.test.evil.com"), false);
  assertEquals(isDemoAccount(null), false);
});

Deno.test("CORS: '*' by default, an allow-list once ALLOWED_ORIGINS is set", () => {
  assertEquals(corsHeaders("https://anywhere.example", null)["Access-Control-Allow-Origin"], "*");
  const allowed = parseAllowedOrigins("https://oops-dance.vercel.app/ , ");
  assertEquals(allowed, ["https://oops-dance.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"]);
  assertEquals(corsHeaders("https://oops-dance.vercel.app", allowed)["Access-Control-Allow-Origin"], "https://oops-dance.vercel.app");
  assertEquals(corsHeaders("http://localhost:5173", allowed)["Access-Control-Allow-Origin"], "http://localhost:5173");
  assertEquals(corsHeaders("https://evil.example", allowed)["Access-Control-Allow-Origin"], undefined);
});
