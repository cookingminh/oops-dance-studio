#!/usr/bin/env node
// Seed a HOSTED Supabase project with the demo data of api-contract §11, through the
// Auth admin API + Data API (service role). Local stacks use supabase/seed.sql.
//
//   cd scripts && npm install
//   node seed-demo.mjs                # reads ../.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD)
//   DEMO_MODE=true node seed-demo.mjs --reset --i-know-this-wipes   # public demo only, see below
//
// Default mode is idempotent: users/rooms/classes/schedules/enrolments are upserted;
// bookings and attendance history are only generated when the demo has none yet.
// Re-running resets every demo account's password to DEMO_PASSWORD. Instructor
// avatars, the class photo and room photos are uploaded by demo-images.mjs.
//
// --reset (the public demo's scheduled reset, .github/workflows/reset-demo.yml) first
// WIPES the project: every Storage object, every row of app data and every auth user
// that is not a demo account (e.g. visitors' sign-ups). It then re-seeds from scratch
// with dates relative to today and restores the demo accounts (password, profile).
// It only runs with --i-know-this-wipes and DEMO_MODE=true in the environment.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { uploadDemoImages } from "./demo-images.mjs";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD, DEMO_MODE } = process.env;
const RESET = process.argv.includes("--reset");
if (RESET && !process.argv.includes("--i-know-this-wipes")) {
  console.error("--reset deletes every user, booking and file in the project. Add --i-know-this-wipes to confirm.");
  process.exit(1);
}
if (RESET && !["1", "true", "yes"].includes((DEMO_MODE ?? "").trim().toLowerCase())) {
  console.error("Refusing to --reset: DEMO_MODE is not set. Only the public demo project may be wiped.");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  process.exit(1);
}
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
  console.error("Set DEMO_PASSWORD (min 8 characters) — the password for every demo account.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Demo definition (same people, rooms and classes as supabase/seed.sql)
// ---------------------------------------------------------------------------
const USERS = [
  ["admin@demo.oopsdance.test",       "admin",      "admin",      "Trần Thị Thu Hà", "0903111001", "1990-04-12"],
  ["staff@demo.oopsdance.test",       "staff",      "staff",      "Lê Hoàng Nam",    "0903111002", "1996-09-03"],
  // The studio's teachers as named on the legacy homepage; no made-up personal details.
  ["instructor@demo.oopsdance.test",  "instructor", "ami",        "Ami",             null,         null],
  ["instructor2@demo.oopsdance.test", "instructor", "bin",        "Bin",             null,         null],
  ["instructor3@demo.oopsdance.test", "instructor", "dolinh",     "Đỗ Linh",         null,         null],
  ["instructor4@demo.oopsdance.test", "instructor", "chaeng",     "Chaeng",          null,         null],
  ["instructor5@demo.oopsdance.test", "instructor", "ducbo",      "Duc Bo",          null,         null],
  ["guest@demo.oopsdance.test",       "guest",      "thaovy",     "Nguyễn Thảo Vy",  "0987333101", "2002-03-15"],
  ["guest02@demo.oopsdance.test",     "guest",      "giabao",     "Trần Gia Bảo",    "0987333102", "2001-06-21"],
  ["guest03@demo.oopsdance.test",     "guest",      "khanhlinh",  "Lê Khánh Linh",   "0987333103", "2003-12-02"],
  ["guest04@demo.oopsdance.test",     "guest",      "quochuy",    "Phạm Quốc Huy",   "0987333104", "1999-08-09"],
  ["guest05@demo.oopsdance.test",     "guest",      "minhthu",    "Hoàng Minh Thư",  "0987333105", "2004-02-27"],
  ["guest06@demo.oopsdance.test",     "guest",      "ducanh",     "Vũ Đức Anh",      "0987333106", "2000-10-14"],
  ["guest07@demo.oopsdance.test",     "guest",      "baongoc",    "Đỗ Bảo Ngọc",     "0987333107", "2005-05-05"],
  ["guest08@demo.oopsdance.test",     "guest",      "tuankiet",   "Bùi Tuấn Kiệt",   "0987333108", "1998-01-11"],
  ["guest09@demo.oopsdance.test",     "guest",      "phuongthao", "Ngô Phương Thảo", "0987333109", "2002-09-19"],
  ["guest10@demo.oopsdance.test",     "guest",      "haidang",    "Dương Hải Đăng",  "0987333110", "2001-04-30"],
  ["guest11@demo.oopsdance.test",     "guest",      "myduyen",    "Lý Mỹ Duyên",     "0987333111", "2003-07-07"],
  ["guest12@demo.oopsdance.test",     "guest",      "hoanglong",  "Đinh Hoàng Long", "0987333112", "1997-03-25"],
  ["guest13@demo.oopsdance.test",     "guest",      "ngochan",    "Trịnh Ngọc Hân",  "0987333113", "2006-11-18"],
  ["guest14@demo.oopsdance.test",     "guest",      "thanhtung",  "Mai Thanh Tùng",  "0987333114", "1999-12-12"],
  ["guest15@demo.oopsdance.test",     "guest",      "nhuquynh",   "Phan Như Quỳnh",  "0987333115", "2004-08-01"],
].map(([email, role, username, full_name, contact_number, date_of_birth]) =>
  ({ email, role, username, full_name, contact_number, date_of_birth }));

const ROOMS = [
  { name: "Phòng A", size: "80 m² · gương 2 mặt · loa JBL", price: 250000 },
  { name: "Phòng B", size: "45 m² · sàn gỗ · máy lạnh",     price: 180000 },
];

// schedules: [ISO weekday 1=Mon…7=Sun, start, end]. Same timetable as seed.sql:
// Ami teaches every day; no two classes overlap in a room.
const CLASSES = [
  { name: "K-pop Cover Cơ Bản", instructor: "instructor@demo.oopsdance.test", room: "Phòng A", price: 900000,
    lesson: "Học vũ đạo các bài K-pop hot, phù hợp người mới bắt đầu. Mỗi tháng hoàn thành 1 bài.",
    schedules: [[1, "18:00", "19:30"], [3, "18:00", "19:30"], [5, "18:00", "19:30"]] },
  { name: "K-pop Cover Nâng Cao", instructor: "instructor@demo.oopsdance.test", room: "Phòng B", price: 1200000,
    lesson: "Cover nguyên bài với đội hình và biểu cảm sân khấu, quay clip cuối tháng.",
    schedules: [[2, "19:00", "20:30"], [4, "19:00", "20:30"], [6, "09:00", "10:30"], [7, "09:00", "10:30"]] },
  { name: "Hip-hop Foundation", instructor: "instructor2@demo.oopsdance.test", room: "Phòng A", price: 1000000,
    lesson: "Groove, bounce, rock và các bước cơ bản của hip-hop, cập nhật các trend mới.",
    schedules: [[2, "18:00", "19:30"], [4, "18:00", "19:30"], [6, "15:00", "16:30"]] },
  { name: "Breaking Kids", instructor: "instructor5@demo.oopsdance.test", room: "Phòng B", price: 800000,
    lesson: "Lớp breakdance cho thiếu nhi 7–12 tuổi: toprock, footwork, freeze.",
    schedules: [[1, "17:00", "18:00"], [3, "17:00", "18:00"], [7, "16:00", "17:00"]] },
  { name: "Contemporary & Jazz", instructor: "instructor3@demo.oopsdance.test", room: "Phòng A", price: 1100000,
    lesson: "Kỹ thuật contemporary kết hợp jazz, chú trọng cảm xúc và đường nét.",
    schedules: [[1, "19:30", "21:00"], [3, "19:30", "21:00"], [6, "10:00", "11:30"]] },
  { name: "Choreography Sáng Tạo", instructor: "instructor4@demo.oopsdance.test", room: "Phòng B", price: 1200000,
    lesson: "Tự biên đạo theo nhóm, khai thác kỹ thuật và ý tưởng mới, trình diễn cuối khoá.",
    schedules: [[5, "18:00", "19:30"], [6, "13:00", "14:30"]] },
];

const BUCKETS = ["avatars", "class-images", "attendance-proofs", "site-assets"];
// Children first, so no foreign key blocks a delete. PostgREST needs a filter on
// every DELETE, hence "<column> is not null".
const APP_TABLES = [
  ["student_attendance", "id"], ["instructor_attendance", "id"], ["class_students", "class_id"],
  ["bookings", "id"], ["class_schedules", "id"], ["classes", "id"], ["rooms", "id"],
];

const BOOKING_SLOTS = [["08:00", "10:00"], ["09:30", "11:30"], ["13:00", "15:00"],
                       ["14:00", "16:00"], ["16:00", "17:30"], ["20:30", "22:00"]];
const BOOKING_DETAILS = ["Tập nhảy cho đám cưới", "Quay clip TikTok nhóm", "Tập văn nghệ công ty",
                         "Luyện bài thi cuối kỳ", "Tập cover nhóm 5 người", "Thuê phòng tự tập", null];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mulberry32(seed) {  // small deterministic PRNG
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(2026);
const pick = (arr) => arr[Math.floor(random() * arr.length)];

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isoDow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() || 7;
const minutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
// Studio local time (Asia/Ho_Chi_Minh, UTC+7, no DST) → ISO timestamp.
const ictTimestamp = (iso, hhmm, offsetMin = 0) =>
  new Date(Date.parse(`${iso}T${hhmm}:00+07:00`) + offsetMin * 60_000).toISOString();

async function chunked(rows, size, fn) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function listAllUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { users } = await must(db.auth.admin.listUsers({ page, perPage: 1000 }), "list users");
    all.push(...users);
    if (users.length < 1000) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
async function wipe() {
  for (const bucket of BUCKETS) await must(db.storage.emptyBucket(bucket), `empty bucket ${bucket}`);
  for (const [table, column] of APP_TABLES) {
    await must(db.from(table).delete().not(column, "is", null), `wipe ${table}`);
  }
  // Demo accounts are kept (and restored below); anyone else is removed with their profile.
  const demoEmails = new Set(USERS.map((u) => u.email));
  const others = (await listAllUsers()).filter((u) => !demoEmails.has(u.email));
  for (const user of others) await must(db.auth.admin.deleteUser(user.id), `delete user ${user.email ?? user.id}`);
  // Visitors may have swapped usernames between demo accounts; free them all before restoring.
  await must(db.from("profiles").update({ username: null }).in("email", [...demoEmails]), "clear demo usernames");
  console.log(`✓ wiped: ${BUCKETS.length} buckets, ${APP_TABLES.length} tables, ${others.length} non-demo users`);
}

async function upsertUsers() {
  const existing = new Map((await listAllUsers()).map((u) => [u.email, u.id]));

  const ids = {};
  for (const u of USERS) {
    const metadata = { username: u.username, full_name: u.full_name,
                       contact_number: u.contact_number, date_of_birth: u.date_of_birth };
    let id = existing.get(u.email);
    if (id) {
      await must(db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD, user_metadata: metadata }), `update ${u.email}`);
    } else {
      const { user } = await must(db.auth.admin.createUser({
        email: u.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: metadata,
      }), `create ${u.email}`);
      id = user.id;
    }
    // Profile row comes from the on_auth_user_created trigger (role guest);
    // the service role is allowed to set the real role. After a wipe, avatars a
    // visitor uploaded are gone, so the path is cleared (demo-images sets the real ones).
    await must(db.from("profiles").update({
      role: u.role, username: u.username, full_name: u.full_name,
      contact_number: u.contact_number, date_of_birth: u.date_of_birth,
      ...(RESET ? { avatar_path: null } : {}),
    }).eq("id", id), `profile ${u.email}`);
    ids[u.email] = id;
  }
  console.log(`✓ ${USERS.length} demo users`);
  return ids;
}

async function upsertCatalogue(userIds) {
  const rooms = await must(db.from("rooms").upsert(ROOMS, { onConflict: "name" }).select("id, name, price"), "rooms");
  const roomByName = Object.fromEntries(rooms.map((r) => [r.name, r]));

  const classes = await must(db.from("classes").upsert(CLASSES.map((c) => ({
    name: c.name, instructor_id: userIds[c.instructor], room_id: roomByName[c.room].id,
    price: c.price, lesson: c.lesson,
  })), { onConflict: "name" }).select("id, name, room_id"), "classes");
  const classByName = Object.fromEntries(classes.map((c) => [c.name, c]));

  const schedules = CLASSES.flatMap((c) => c.schedules.map(([day_of_week, start_time, end_time]) =>
    ({ class_id: classByName[c.name].id, day_of_week, start_time, end_time })));
  await must(db.from("class_schedules").upsert(schedules,
    { onConflict: "class_id,day_of_week,start_time" }), "class_schedules");

  console.log(`✓ ${rooms.length} rooms, ${classes.length} classes, ${schedules.length} schedules`);
  return { rooms, classes, schedules };
}

async function upsertEnrolments(userIds, classes, today) {
  const guests = USERS.filter((u) => u.role === "guest");
  const rows = [];
  guests.forEach((g, i) => {
    const picks = new Set([i % classes.length, (i * 3 + 1) % classes.length]);
    if (i % 3 === 0) picks.add((i + 2) % classes.length);
    if (g.email === "guest@demo.oopsdance.test") {
      picks.clear();
      classes.forEach((c, idx) => { if (["K-pop Cover Cơ Bản", "Hip-hop Foundation"].includes(c.name)) picks.add(idx); });
    }
    for (const idx of picks) {
      rows.push({ class_id: classes[idx].id, student_id: userIds[g.email], joined_at: addDays(today, -(60 + (i * 7) % 41)) });
    }
  });
  await must(db.from("class_students").upsert(rows,
    { onConflict: "class_id,student_id", ignoreDuplicates: true }), "class_students");
  console.log(`✓ ${rows.length} enrolments`);
}

async function seedBookings(userIds, rooms, classes, schedules, today) {
  const guestIds = USERS.filter((u) => u.role === "guest").map((u) => userIds[u.email]);
  const { count, error } = await db.from("bookings")
    .select("id", { count: "exact", head: true }).in("guest_id", guestIds);
  if (error) throw new Error(`count bookings: ${error.message}`);
  if ((count ?? 0) > 0) {
    console.log(`• ${count} demo bookings already present — skipped`);
    return;
  }

  // Same guards as the database, so the bulk insert never trips them.
  const classRoom = Object.fromEntries(classes.map((c) => [c.id, c.room_id]));
  const busy = new Map(); // "room|date" -> [[start, end]] in minutes
  const overlaps = (key, s, e) => (busy.get(key) ?? []).some(([bs, be]) => s < be && e > bs);
  const classBusy = (roomId, date, s, e) => schedules.some((sc) =>
    classRoom[sc.class_id] === roomId && sc.day_of_week === isoDow(date)
    && s < minutes(sc.end_time) && e > minutes(sc.start_time));

  const rows = [];
  for (let date = addDays(today, -90); date <= addDays(today, 14); date = addDays(date, 1)) {
    for (const room of rooms) {
      const tries = isoDow(date) >= 6 ? 3 : 2;
      for (let k = 0; k < tries; k++) {
        if (random() < 0.45) continue;
        const [start, end] = pick(BOOKING_SLOTS);
        const s = minutes(start), e = minutes(end), key = `${room.id}|${date}`;
        if (classBusy(room.id, date, s, e) || overlaps(key, s, e)) continue;

        const past = date < today;
        const status = past
          ? (random() < 0.8 ? "completed" : random() < 0.5 ? "cancelled" : "rejected")
          : (random() < 0.5 ? "pending" : "approved");
        if (status === "pending" || status === "approved") busy.set(key, [...(busy.get(key) ?? []), [s, e]]);

        const total = (room.price * (e - s)) / 60;
        const cash = random() < 0.5 ? total : Math.round((total * 0.3) / 1000) * 1000;
        const done = status === "completed";
        rows.push({
          room_id: room.id, guest_id: pick(guestIds), date, start_time: start, end_time: end, status,
          deposit: Math.round(total * 0.5),
          deposit_status: status === "pending" ? "waiting"
            : status === "cancelled" || status === "rejected" ? "cancelled" : "completed",
          full_payment: total,
          real_income: done ? total : null,
          cash: done ? cash : null,
          bank_transfer: done ? total - cash : null,
          details: pick(BOOKING_DETAILS),
        });
      }
    }
  }
  await chunked(rows, 200, (chunk) => must(db.from("bookings").insert(chunk), "bookings"));
  console.log(`✓ ${rows.length} bookings (${addDays(today, -90)} → ${addDays(today, 14)})`);
}

async function seedAttendance(schedules, today) {
  const monday = addDays(today, -(isoDow(today) - 1));

  let created = 0;
  for (let w = 8; w >= 0; w--) {
    created += await must(db.rpc("generate_instructor_attendance", { p_week_start: addDays(monday, -7 * w) }),
      "generate_instructor_attendance");
  }
  for (let d = 28; d >= 0; d--) {
    created += await must(db.rpc("generate_student_attendance", { p_date: addDays(today, -d) }),
      "generate_student_attendance");
  }

  // History: only rows still pending in the past are filled in, so re-runs are no-ops.
  const firstSession = (classId, dow) => schedules
    .filter((s) => s.class_id === classId && s.day_of_week === dow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];

  const sessions = await must(db.from("instructor_attendance").select("*")
    .lt("date", today).eq("status", "pending"), "past sessions");
  const sessionStatus = new Map();
  const sessionRows = sessions.map((a) => {
    const sch = firstSession(a.class_id, isoDow(a.date));
    const cancelled = random() < 0.08 || !sch;
    sessionStatus.set(`${a.class_id}|${a.date}`, cancelled ? "cancelled" : "completed");
    return cancelled
      ? { ...a, status: "cancelled", details: "Nghỉ lễ / giáo viên báo nghỉ" }
      : { ...a, status: "completed",
          checkin_at: ictTimestamp(a.date, sch.start_time.slice(0, 5), -5),
          checkout_at: ictTimestamp(a.date, sch.end_time.slice(0, 5), 5) };
  });
  await chunked(sessionRows, 200, (chunk) =>
    must(db.from("instructor_attendance").upsert(chunk, { onConflict: "id" }), "session history"));

  const rolls = await must(db.from("student_attendance").select("*")
    .lt("date", today).eq("status", "pending"), "past roll calls");
  const rollRows = rolls.map((r) => {
    if (sessionStatus.get(`${r.class_id}|${r.date}`) === "cancelled") {
      return { ...r, status: "absent", details: "Buổi học bị huỷ" };
    }
    const roll = random();
    return { ...r, status: roll < 0.85 ? "attend" : "absent", details: roll > 0.95 ? "Xin phép nghỉ ốm" : null };
  });
  await chunked(rollRows, 500, (chunk) =>
    must(db.from("student_attendance").upsert(chunk, { onConflict: "id" }), "roll history"));

  console.log(`✓ attendance: ${created} rows generated, ${sessionRows.length} sessions + ${rollRows.length} roll calls filled in`);
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`${RESET ? "Resetting" : "Seeding"} demo data in ${SUPABASE_URL}`);
  const today = await must(db.rpc("studio_today"), "studio_today");
  if (RESET) await wipe();
  const userIds = await upsertUsers();
  const { rooms, classes, schedules } = await upsertCatalogue(userIds);
  await upsertEnrolments(userIds, classes, today);
  await seedBookings(userIds, rooms, classes, schedules, today);
  await seedAttendance(schedules, today);
  await uploadDemoImages(db);
  console.log("Done. Demo logins: admin@ / staff@ / instructor@ / guest@demo.oopsdance.test with DEMO_PASSWORD.");
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
