// bank-webhook — incoming bank transfers become tuition payments (api-contract §6).
//
// A bank-sync service (SePay, https://sepay.vn) calls this URL for every transaction on the
// studio's bank account. Each transfer is stored once (provider + id) and, when its content
// holds an invoice code (OOPS + 6 characters), pays that invoice: see tuition_record_transfer()
// in supabase/migrations/20261112000100_tuition.sql. Transfers without a code wait in the
// staff inbox (/admin/tuition) to be assigned by hand.
//
// Auth   header `Authorization: Apikey <BANK_WEBHOOK_KEY>` (what SePay sends) or `x-api-key`.
// Body   SePay: { id, gateway, transactionDate: "2026-11-09 14:02:37" (Vietnam time),
//        accountNumber, content, transferType: "in" | "out", transferAmount, referenceCode,
//        description }. Money going out is acknowledged and ignored.
// Reply  200 { success: true, status, invoice_id, duplicate }  (SePay retries anything else)
//        4xx/5xx { success: false, error: "CODE: message" }
//
// This module has no side effects so it can be unit-tested; index.ts serves it.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Deps {
  admin: SupabaseClient; // service-role client
  apiKey: string | undefined; // BANK_WEBHOOK_KEY
}

export interface Transfer {
  provider: string;
  ref: string;
  amount: number;
  content: string;
  receivedAt: string; // ISO
  raw: Record<string, unknown>;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** The key the caller sent: `Authorization: Apikey <key>` / `Bearer <key>`, or `x-api-key`. */
export function keyFromHeaders(headers: Headers): string | null {
  const match = /^(?:apikey|bearer)\s+(.+)$/i.exec((headers.get("authorization") ?? "").trim());
  if (match) return match[1].trim();
  return headers.get("x-api-key")?.trim() || null;
}

/** Compares without leaking where the strings differ. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** "2026-11-09 14:02:37" (Vietnam time, no zone) → ISO instant. Unreadable → `now`. */
export function vietnamTime(value: unknown, now = new Date()): string {
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/.exec(value.trim());
    if (match) {
      const instant = new Date(`${match[1]}T${match[2]}${match[3] ?? ":00"}+07:00`);
      if (!Number.isNaN(instant.getTime())) return instant.toISOString();
    }
  }
  return now.toISOString();
}

/** A SePay transaction, or null for money going out. Throws 400 on a malformed body. */
export function parseSepay(body: Record<string, unknown>, now = new Date()): Transfer | null {
  if (body.transferType !== undefined && String(body.transferType).toLowerCase() !== "in") return null;
  const amount = Number(body.transferAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "INVALID_INPUT", "transferAmount must be a positive number");
  }
  const id = body.id ?? body.referenceCode;
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new HttpError(400, "INVALID_INPUT", "id is required");
  }
  // The code can end up in either field depending on the bank.
  const content = [body.content, body.description]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" | ")
    .slice(0, 500);
  return {
    provider: "sepay",
    ref: String(id).trim().slice(0, 100),
    amount: Math.round(amount),
    content,
    receivedAt: vietnamTime(body.transactionDate, now),
    raw: body,
  };
}

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  try {
    if (req.method !== "POST") throw new HttpError(405, "INVALID_INPUT", "use POST");
    if (!deps.apiKey) throw new HttpError(503, "NOT_CONFIGURED", "set the BANK_WEBHOOK_KEY secret");
    const key = keyFromHeaders(req.headers);
    if (!key || !safeEqual(key, deps.apiKey)) throw new HttpError(401, "FORBIDDEN", "wrong or missing API key");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "INVALID_INPUT", "the body must be JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "INVALID_INPUT", "the body must be a JSON object");
    }

    const transfer = parseSepay(body as Record<string, unknown>);
    if (!transfer) return json(200, { success: true, ignored: "money out" });

    const { data, error } = await deps.admin.rpc("tuition_record_transfer", {
      p_provider: transfer.provider,
      p_ref: transfer.ref,
      p_amount: transfer.amount,
      p_content: transfer.content,
      p_received_at: transfer.receivedAt,
      p_raw: transfer.raw,
    });
    if (error) throw new HttpError(500, "INTERNAL", error.message);
    const result = (data ?? {}) as Record<string, unknown>;
    return json(200, {
      success: true,
      status: result.status ?? null,
      invoice_id: result.invoice_id ?? null,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { success: false, error: `${error.code}: ${error.message}` });
    }
    return json(500, { success: false, error: `INTERNAL: ${error instanceof Error ? error.message : String(error)}` });
  }
}
