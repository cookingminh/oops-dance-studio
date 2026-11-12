#!/usr/bin/env node
// Upload the demo images to Supabase Storage and point the demo rows at them.
// seed.sql cannot upload files, so run this after every local `supabase db reset`;
// seed-demo.mjs calls it for hosted projects.
//
//   node demo-images.mjs --local   # local stack: URL + service key read from `supabase status`
//   node demo-images.mjs           # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from ../.env
//
// Sources (read only, committed):
//   scripts/demo-assets/<teacher>.webp             → avatars/{instructor_id}/avatar-{hash}.webp (profiles.avatar_path)
//   scripts/demo-assets/class_*.webp               → class-images/{class_id}/{uuid}.webp    (classes.image_path = first)
//   scripts/demo-assets/timetable_*.webp           → class-images/{class_id}/{uuid}.webp    (classes.timetable_photo_path)
//   frontend/src/assets/images/room{N}-*.webp      → site-assets/rooms/{room_id}/{file}     (rooms.image_paths, in order)
//   scripts/demo-assets/promo_*.mp4 / .jpg         → class-promos/{class_id}/{lesson_id}/…  (class_lessons.promo_*)
// Missing sources are skipped with a note. Idempotent: deterministic object
// names, uploaded with upsert.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The teachers' photos and the November timetable posters, as WebP.
const DEMO_ASSETS_DIR = resolve(REPO_ROOT, "scripts", "demo-assets");
const ROOM_PHOTOS_DIR = resolve(REPO_ROOT, "frontend", "src", "assets", "images");

// Demo instructor (api-contract §11) → their photo.
const AVATARS = [
  ["instructor@demo.oopsdance.test",  "dolinh.webp"],
  ["instructor2@demo.oopsdance.test", "soleck.webp"],
  ["instructor3@demo.oopsdance.test", "antrinh.webp"],
  ["instructor4@demo.oopsdance.test", "vananh.webp"],
  ["instructor5@demo.oopsdance.test", "ducanh.webp"],
];
// Each class's timetable poster; the first file becomes the class image.
const CLASS_IMAGES = [
  ["Trending", ["class_trending.webp"]],
  ["Choreo CG", ["class_choreo_cg.webp"]],
  ["K-pop Dance", ["class_kpop_dance.webp"]],
  ["Girlstyle 2", ["class_girlstyle_2.webp"]],
  ["Choreo BT", ["class_choreo_bt.webp"]],
  ["Girlstyle 1", ["class_girlstyle_1.webp"]],
  ["Newbie 1", ["class_newbie.webp"]],
  ["Newbie 2", ["class_newbie.webp"]],
];
// Each class's photo on the poster timetable: cut-outs, square, the face in the middle (as on the printed
// schedule, Đỗ Linh smiles for Trending and wears the white jacket for Newbie 1 and Choreo CG).
const TIMETABLE_PHOTOS = [
  ["Trending", "timetable_dolinh_smile.webp"],
  ["Choreo CG", "timetable_dolinh.webp"],
  ["Newbie 1", "timetable_dolinh.webp"],
  ["K-pop Dance", "timetable_ducanh.webp"],
  ["Girlstyle 1", "timetable_antrinh.webp"],
  ["Girlstyle 2", "timetable_vananh.webp"],
  ["Choreo BT", "timetable_soleck.webp"],
  ["Newbie 2", "timetable_soleck.webp"],
];
// Demo room → prefix of its bundled photo set (the frontend's old position rule).
const ROOM_PHOTOS = [
  ["Phòng A", "room1-"],
  ["Phòng B", "room2-"],
];

// A planned routine (by title) → its instructor's promo clip, poster frame, length and line for students.
// The demo instructor's own next routine gets none, so their overview asks them to film it.
// (None in the November demo: the teachers film their own.)
const PROMOS = [];

const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };

// Stable uuid-shaped name, so re-runs overwrite instead of piling up copies.
function stableUuid(seed) {
  const h = createHash("sha1").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function upload(db, bucket, path, file) {
  const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
  const { error } = await db.storage.from(bucket).upload(path, await readFile(file), { contentType, upsert: true });
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`);
}

async function setColumn(db, table, column, value, id, what) {
  const { error } = await db.from(table).update({ [column]: value }).eq("id", id);
  if (error) throw new Error(`${table}.${column} (${what}): ${error.message}`);
}

async function uploadAvatarsAndClassPhotos(db, log) {
  if (!existsSync(DEMO_ASSETS_DIR)) {
    log(`• ${relative(REPO_ROOT, DEMO_ASSETS_DIR)} not found — instructor avatars / class photos skipped`);
    return;
  }
  let avatars = 0;
  for (const [email, file] of AVATARS) {
    const src = resolve(DEMO_ASSETS_DIR, file);
    const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile || !existsSync(src)) { log(`  skip avatar ${email} (${profile ? "no file" : "no user"})`); continue; }
    // Named after its content (as the app names a new picture), so a changed photo gets a new URL and
    // browsers that cached the old one show the new one; the folder's other pictures are removed.
    const hash = createHash("sha256").update(await readFile(src)).digest("hex").slice(0, 8);
    const path = `${profile.id}/avatar-${hash}${extname(file).toLowerCase()}`;
    await upload(db, "avatars", path, src);
    await setColumn(db, "profiles", "avatar_path", path, profile.id, email);
    const { data: old } = await db.storage.from("avatars").list(profile.id);
    const stale = (old ?? []).map((o) => `${profile.id}/${o.name}`).filter((p) => p !== path);
    if (stale.length) await db.storage.from("avatars").remove(stale);
    avatars++;
  }

  let classPhotos = 0;
  for (const [className, files] of CLASS_IMAGES) {
    const { data: cls } = await db.from("classes").select("id").eq("name", className).maybeSingle();
    if (!cls) { log(`  skip photos for class "${className}" (no class)`); continue; }
    const paths = [];
    for (const file of files) {
      const src = resolve(DEMO_ASSETS_DIR, file);
      if (!existsSync(src)) continue;
      const path = `${cls.id}/${stableUuid(`oops-demo:${file}`)}${extname(file).toLowerCase()}`;
      await upload(db, "class-images", path, src);
      paths.push(path);
    }
    if (paths.length) await setColumn(db, "classes", "image_path", paths[0], cls.id, className);
    classPhotos += paths.length;
  }

  let timetablePhotos = 0;
  for (const [className, file] of TIMETABLE_PHOTOS) {
    const { data: cls } = await db.from("classes").select("id").eq("name", className).maybeSingle();
    const src = resolve(DEMO_ASSETS_DIR, file);
    if (!cls || !existsSync(src)) { log(`  skip timetable photo for "${className}" (${cls ? "no file" : "no class"})`); continue; }
    const path = `${cls.id}/${stableUuid(`oops-demo:${file}`)}${extname(file).toLowerCase()}`;
    await upload(db, "class-images", path, src);
    await setColumn(db, "classes", "timetable_photo_path", path, cls.id, className);
    timetablePhotos++;
  }
  log(`✓ images: ${avatars} instructor avatars, ${classPhotos} class photos, ${timetablePhotos} timetable photos`);
}

async function uploadRoomPhotos(db, log) {
  if (!existsSync(ROOM_PHOTOS_DIR)) {
    log(`• ${relative(REPO_ROOT, ROOM_PHOTOS_DIR)} not found — room photos skipped`);
    return;
  }
  const bundled = readdirSync(ROOM_PHOTOS_DIR).sort();
  let photos = 0;
  for (const [roomName, prefix] of ROOM_PHOTOS) {
    const { data: room } = await db.from("rooms").select("id").eq("name", roomName).maybeSingle();
    const files = bundled.filter((f) => f.startsWith(prefix) && CONTENT_TYPES[extname(f).toLowerCase()]);
    if (!room || !files.length) { log(`  skip photos for room "${roomName}" (${room ? "no files" : "no room"})`); continue; }
    const paths = [];
    for (const file of files) {
      const path = `rooms/${room.id}/${file}`;
      await upload(db, "site-assets", path, resolve(ROOM_PHOTOS_DIR, file));
      paths.push(path);
    }
    await setColumn(db, "rooms", "image_paths", paths, room.id, roomName);
    photos += paths.length;
  }
  log(`✓ images: ${photos} room photos`);
}

async function uploadPromos(db, log) {
  let promos = 0;
  for (const [title, clip, poster, seconds, caption] of PROMOS) {
    const { data: lesson } = await db.from("class_lessons").select("id, class_id, classes(instructor_id)")
      .eq("title", title).gt("starts_on", new Date().toISOString().slice(0, 10)).order("starts_on").limit(1).maybeSingle();
    const clipSrc = resolve(DEMO_ASSETS_DIR, clip);
    const posterSrc = resolve(DEMO_ASSETS_DIR, poster);
    if (!lesson || !existsSync(clipSrc)) { log(`  skip promo of "${title}" (${lesson ? "no file" : "no planned routine"})`); continue; }
    const folder = `${lesson.class_id}/${lesson.id}`;
    const clipPath = `${folder}/${stableUuid(`oops-demo:${clip}`)}.mp4`;
    await upload(db, "class-promos", clipPath, clipSrc);
    let posterPath = null;
    if (existsSync(posterSrc)) {
      posterPath = `${folder}/${stableUuid(`oops-demo:${poster}`)}.jpg`;
      await upload(db, "class-promos", posterPath, posterSrc);
    }
    const { error } = await db.from("class_lessons").update({
      promo_path: clipPath, promo_poster_path: posterPath, promo_caption: caption, promo_seconds: seconds,
      promo_by: lesson.classes?.instructor_id ?? null, promo_at: new Date().toISOString(),
    }).eq("id", lesson.id);
    if (error) throw new Error(`class_lessons.promo_* (${title}): ${error.message}`);
    promos++;
  }
  log(`✓ promos: ${promos} promo clip${promos === 1 ? "" : "s"}`);
}

export async function uploadDemoImages(db, { log = console.log } = {}) {
  await uploadAvatarsAndClassPhotos(db, log);
  await uploadRoomPhotos(db, log);
  await uploadPromos(db, log);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function connection() {
  if (process.argv.includes("--local")) {
    const env = Object.fromEntries(
      execFileSync("supabase", ["status", "-o", "env"], { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .split("\n").map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean)
        .map(([, key, value]) => [key, value]));
    return { url: env.API_URL, key: env.SERVICE_ROLE_KEY };
  }
  const envFile = resolve(REPO_ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url, key } = connection();
  if (!url || !key) {
    console.error("Missing Supabase URL / service role key (use --local, or fill .env — see .env.example).");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`Uploading demo images to ${url}`);
  uploadDemoImages(db).catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
