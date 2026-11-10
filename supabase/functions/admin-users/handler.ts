// admin-users — create / re-email / delete auth users (api-contract §6).
//
// Auth users can only be created, re-emailed or deleted with the service role, so this
// function holds it server-side. The caller must be an admin: their JWT is
// verified with GoTrue (auth.getUser) and their role read from profiles.
//
// POST body
//   { action: "create", email, password, full_name, role, contact_number?, date_of_birth? }
//   { action: "update", user_id, email }
//   { action: "delete", user_id }
// Success  200 { ok: true, user: <profiles row> }   (create, update)
//          200 { ok: true, user_id }                (delete)
// Failure  4xx/5xx { error: "CODE: message", code: "CODE" }, CODE ∈ FORBIDDEN |
//          NOT_FOUND | INVALID_STATE | INVALID_INPUT | INTERNAL — same prefixes as the RPCs.
//
// Public demo: with the DEMO_MODE secret set, update and delete on the shared
// @demo.oopsdance.test accounts are refused with 403 FORBIDDEN: demo account.
//
// This module has no side effects so it can be unit-tested; index.ts serves it.

import type { SupabaseClient } from "@supabase/supabase-js";

const ROLES = ["admin", "staff", "instructor", "guest"] as const;
type Role = (typeof ROLES)[number];

export const DEMO_EMAIL_DOMAIN = "@demo.oopsdance.test";

export interface Deps {
  admin: SupabaseClient; // service-role client
  demoMode: boolean;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return json(status, { error: `${code}: ${message}`, code });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** "1" / "true" / "yes" (any case) turn a flag secret on. */
export function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes"].includes((value ?? "").trim().toLowerCase());
}

export function isDemoAccount(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}

// ---------------------------------------------------------------------------
// CORS: `*` unless ALLOWED_ORIGINS is set (comma-separated). Local dev origins
// stay allowed so the frontend can run against a hosted project.
// ---------------------------------------------------------------------------
const LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function parseAllowedOrigins(value: string | undefined): string[] | null {
  const origins = (value ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  return origins.length ? [...origins, ...LOCAL_ORIGINS] : null;
}

export function corsHeaders(origin: string | null, allowed: string[] | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (!allowed) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else {
    headers["Vary"] = "Origin";
    if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function isEmailTaken(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "email_exists" || /already/i.test(error?.message ?? "");
}

async function getProfile(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new HttpError(500, "INTERNAL", error.message);
  if (!data) throw new HttpError(404, "NOT_FOUND", "user not found");
  return data;
}

// The demo accounts are shared by every visitor of the public demo.
function refuseDemoAccount(deps: Deps, profile: { email?: string | null }) {
  if (deps.demoMode && isDemoAccount(profile.email)) {
    throw new HttpError(403, "FORBIDDEN", "demo account");
  }
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "INVALID_INPUT", `${key} is required`);
  }
  return value.trim();
}

function optionalString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT", `${key} must be a string`);
  return value.trim();
}

async function requireAdmin(req: Request, admin: SupabaseClient): Promise<string> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "FORBIDDEN", "missing bearer token");

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "FORBIDDEN", "invalid or expired token");

  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) throw new HttpError(500, "INTERNAL", profileError.message);
  if (profile?.role !== "admin") throw new HttpError(403, "FORBIDDEN", "admin only");

  return user.id;
}

// The activity log (activity_log, migration 20261117000200) sees account changes made here as the system:
// the service role has no signed-in person. This names the admin who made them. Best effort — the account
// change has already happened, so a failure here is only logged.
async function noteActivity(
  admin: SupabaseClient,
  callerId: string,
  userId: string,
  action: "account_created" | "account_deleted" | "profile_edited",
  details: { meta?: Record<string, unknown>; changes?: Record<string, unknown>; label?: string } = {},
) {
  try {
    const { data: caller } = await admin
      .from("profiles").select("full_name, username, email, role").eq("id", callerId).maybeSingle();
    const actor = {
      actor_id: callerId,
      actor_name: caller?.full_name?.trim() || caller?.username || caller?.email || null,
      actor_role: caller?.role ?? "admin",
    };
    if (action === "profile_edited") {
      const { error } = await admin.from("activity_log").insert({
        ...actor, area: "users", action, entity: "profiles", entity_id: userId, subject_id: userId,
        label: details.label ?? "", meta: details.meta ?? null, changes: details.changes ?? null,
      });
      if (error) throw error;
      return;
    }
    const { error } = await admin.from("activity_log")
      .update({ ...actor, ...(details.meta ? { meta: details.meta } : {}) })
      .eq("entity", "profiles").eq("entity_id", userId).eq("action", action).is("actor_id", null);
    if (error) throw error;
  } catch (err) {
    console.error("activity log:", err);
  }
}

async function createUser(admin: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  const email = requireString(body, "email").toLowerCase();
  const password = requireString(body, "password");
  const fullName = requireString(body, "full_name");
  const role = requireString(body, "role") as Role;
  const contactNumber = optionalString(body, "contact_number");
  const dateOfBirth = optionalString(body, "date_of_birth");

  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, "INVALID_INPUT", "email is not valid");
  }
  if (password.length < 8) {
    throw new HttpError(400, "INVALID_INPUT", "password must be at least 8 characters");
  }
  if (!ROLES.includes(role)) {
    throw new HttpError(400, "INVALID_INPUT", `role must be one of ${ROLES.join(", ")}`);
  }
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new HttpError(400, "INVALID_INPUT", "date_of_birth must be YYYY-MM-DD");
  }

  // The on_auth_user_created trigger creates the profile as 'guest'.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, contact_number: contactNumber, date_of_birth: dateOfBirth },
  });
  if (error || !data.user) {
    const taken = isEmailTaken(error);
    throw new HttpError(taken ? 409 : 400, taken ? "INVALID_STATE" : "INVALID_INPUT",
      error?.message ?? "could not create user");
  }

  // Service role may set the role (profiles guard allows service context).
  const { data: profile, error: roleError } = await admin
    .from("profiles").update({ role }).eq("id", data.user.id).select().single();
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id); // roll back the half-created user
    throw new HttpError(500, "INTERNAL", roleError.message);
  }
  await noteActivity(admin, callerId, data.user.id, "account_created", { meta: { email, role } });
  return json(200, { ok: true, user: profile });
}

// Changes another user's auth email (applied immediately, no confirmation mail);
// the on_auth_user_email_changed trigger mirrors it into profiles.email.
async function updateUser(deps: Deps, callerId: string, body: Record<string, unknown>) {
  const { admin } = deps;
  const userId = requireString(body, "user_id");
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_INPUT", "user_id must be a uuid");
  const email = optionalString(body, "email")?.toLowerCase();
  if (!email) throw new HttpError(400, "INVALID_INPUT", "nothing to update (email is required)");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "INVALID_INPUT", "email is not valid");

  const before = await getProfile(admin, userId);
  refuseDemoAccount(deps, before);
  // GoTrue only reports a clash as a generic "Error updating user".
  const { count, error: clashError } = await admin.from("profiles")
    .select("id", { count: "exact", head: true }).eq("email", email).neq("id", userId);
  if (clashError) throw new HttpError(500, "INTERNAL", clashError.message);
  if ((count ?? 0) > 0) throw new HttpError(409, "INVALID_STATE", "email is already used by another account");

  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) {
    const taken = isEmailTaken(error);
    throw new HttpError(taken ? 409 : 400, taken ? "INVALID_STATE" : "INVALID_INPUT", error.message);
  }
  const after = await getProfile(admin, userId);
  if (before.email !== after.email) {
    await noteActivity(admin, callerId, userId, "profile_edited", {
      label: after.full_name?.trim() || after.username || after.email || "",
      meta: { email: after.email, role: after.role },
      changes: { email: { from: before.email, to: after.email } },
    });
  }
  return json(200, { ok: true, user: after });
}

async function deleteUser(deps: Deps, callerId: string, body: Record<string, unknown>) {
  const { admin } = deps;
  const userId = requireString(body, "user_id");
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_INPUT", "user_id must be a uuid");
  if (userId === callerId) throw new HttpError(409, "INVALID_STATE", "admins cannot delete themselves");

  refuseDemoAccount(deps, await getProfile(admin, userId));

  // Bookings and teaching history are kept (FKs without cascade). Refuse with a
  // readable reason instead of GoTrue's generic "Database error deleting user".
  // Payslips would cascade away with the profile, so they block a delete too: pay
  // history stays for the studio's records.
  const count = async (table: string, column: string, key = "id") => {
    const { count, error } = await admin.from(table).select(key, { count: "exact", head: true }).eq(column, userId);
    if (error) throw new HttpError(500, "INTERNAL", error.message);
    return count ?? 0;
  };
  const [classes, bookings, sessions, payslips] = await Promise.all([
    count("classes", "instructor_id"),
    count("bookings", "guest_id"),
    count("instructor_attendance", "instructor_id"),
    count("payslips", "profile_id", "profile_id"),
  ]);
  if (classes + bookings + sessions + payslips > 0) {
    throw new HttpError(409, "INVALID_STATE",
      `user still has ${classes} class(es), ${bookings} booking(s), ${sessions} teaching session(s), ${payslips} payslip(s)`);
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new HttpError(500, "INTERNAL", error.message);
  await noteActivity(admin, callerId, userId, "account_deleted");
  return json(200, { ok: true, user_id: userId });
}

/** Handles one POST (CORS is added by the caller). */
export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return errorResponse(405, "INVALID_INPUT", "POST only");

  try {
    const callerId = await requireAdmin(req, deps.admin);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "INVALID_INPUT", "body must be JSON");
    }

    switch (body?.action) {
      case "create":
        return await createUser(deps.admin, callerId, body);
      case "update":
        return await updateUser(deps, callerId, body);
      case "delete":
        return await deleteUser(deps, callerId, body);
      default:
        throw new HttpError(400, "INVALID_INPUT", 'action must be "create", "update" or "delete"');
    }
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.code, err.message);
    console.error(err);
    return errorResponse(500, "INTERNAL", "unexpected error");
  }
}
