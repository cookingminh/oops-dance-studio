// Unit tests for handler.ts with a stand-in for the service-role client. No Supabase stack needed:
//   deno test --config supabase/functions/bank-webhook/deno.json supabase/functions/bank-webhook/
// deno-lint-ignore-file no-explicit-any

import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleRequest, keyFromHeaders, parseSepay, safeEqual, vietnamTime } from "./handler.ts";

const KEY = "test-key-123";

function fakeAdmin(result: unknown = { status: "matched", invoice_id: 7, duplicate: false }, error: unknown = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: result, error });
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

const sepay = {
  id: 92704,
  gateway: "Vietcombank",
  transactionDate: "2026-11-09 14:02:37",
  accountNumber: "0000000000",
  content: "OOPS7K3M9Q hoc phi thang 11",
  transferType: "in",
  transferAmount: 900000,
  referenceCode: "MBVCB.3278907687",
  description: "",
};

function post(body: unknown, headers: Record<string, string> = { Authorization: `Apikey ${KEY}` }) {
  return new Request("http://localhost/bank-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

Deno.test("reads the key from Apikey, Bearer or x-api-key", () => {
  assertEquals(keyFromHeaders(new Headers({ Authorization: "Apikey abc" })), "abc");
  assertEquals(keyFromHeaders(new Headers({ Authorization: "bearer abc" })), "abc");
  assertEquals(keyFromHeaders(new Headers({ "x-api-key": "abc" })), "abc");
  assertEquals(keyFromHeaders(new Headers()), null);
  assertEquals(safeEqual("abc", "abc"), true);
  assertEquals(safeEqual("abc", "abd"), false);
  assertEquals(safeEqual("abc", "abcd"), false);
});

Deno.test("SePay times are Vietnam time", () => {
  assertEquals(vietnamTime("2026-11-09 14:02:37"), "2026-11-09T07:02:37.000Z");
  assertEquals(vietnamTime("2026-11-09 14:02"), "2026-11-09T07:02:00.000Z");
  const now = new Date("2026-01-01T00:00:00Z");
  assertEquals(vietnamTime("yesterday", now), now.toISOString());
});

Deno.test("parses money in, ignores money out, rejects nonsense", () => {
  const transfer = parseSepay(sepay)!;
  assertEquals(transfer.ref, "92704");
  assertEquals(transfer.amount, 900000);
  assertEquals(transfer.content, "OOPS7K3M9Q hoc phi thang 11");
  assertEquals(parseSepay({ ...sepay, transferType: "out" }), null);
  assertEquals(parseSepay({ ...sepay, content: "", description: "MBVCB OOPS7K3M9Q" })!.content, "MBVCB OOPS7K3M9Q");
  let failed = false;
  try {
    parseSepay({ ...sepay, transferAmount: -5 });
  } catch {
    failed = true;
  }
  assertEquals(failed, true);
});

Deno.test("records a transfer through tuition_record_transfer", async () => {
  const { admin, calls } = fakeAdmin();
  const res = await handleRequest(post(sepay), { admin, apiKey: KEY });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true, status: "matched", invoice_id: 7, duplicate: false });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].fn, "tuition_record_transfer");
  assertEquals(calls[0].args.p_provider, "sepay");
  assertEquals(calls[0].args.p_ref, "92704");
  assertEquals(calls[0].args.p_amount, 900000);
  assertEquals(calls[0].args.p_received_at, "2026-11-09T07:02:37.000Z");
});

Deno.test("refuses a wrong key, a missing secret, GET and bad JSON", async () => {
  const { admin, calls } = fakeAdmin();
  assertEquals((await handleRequest(post(sepay, { Authorization: "Apikey nope" }), { admin, apiKey: KEY })).status, 401);
  assertEquals((await handleRequest(post(sepay, {}), { admin, apiKey: KEY })).status, 401);
  assertEquals((await handleRequest(post(sepay), { admin, apiKey: undefined })).status, 503);
  assertEquals((await handleRequest(new Request("http://localhost/", { method: "GET" }), { admin, apiKey: KEY })).status, 405);
  assertEquals((await handleRequest(post("{not json"), { admin, apiKey: KEY })).status, 400);
  assertEquals(calls.length, 0);
});

Deno.test("money out is acknowledged without touching the database", async () => {
  const { admin, calls } = fakeAdmin();
  const res = await handleRequest(post({ ...sepay, transferType: "out" }), { admin, apiKey: KEY });
  assertEquals(res.status, 200);
  assertEquals((await res.json()).ignored, "money out");
  assertEquals(calls.length, 0);
});

Deno.test("a database error is a 500 so SePay retries", async () => {
  const { admin } = fakeAdmin(null, { message: "boom" });
  const res = await handleRequest(post(sepay), { admin, apiKey: KEY });
  assertEquals(res.status, 500);
  assertEquals((await res.json()).success, false);
});
