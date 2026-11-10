import { supabase } from '@/lib/supabase';
import { getStudioToday } from './studio';
import { unwrap } from './errors';
import { BUCKETS, removeFiles, uploadClassImage } from './storage';
import { PROMO_BUCKET, PROMO_COLUMNS } from './promos';

// Column hints (!instructor_id, !room_id, …) are required: classes and profiles are also linked
// through class_students / attendance, so PostgREST can't pick the relationship on its own.
const PERSON = 'id, username, full_name, email, avatar_path, updated_at';
// A routine (class_lessons) with its class video and its promo (services/promos.js).
const LESSON_COLUMNS = `id, class_id, month, starts_on, session_count, price, title, video_url, ${PROMO_COLUMNS}`;
const CLASS_SELECT = `id, name, price, lesson, image_path, instructor_id, room_id, created_at,
    starts_on, ended_on, end_reason, final_schedule,
    instructor:profiles!instructor_id(${PERSON}),
    room:rooms!room_id(id, name, size),
    schedules:class_schedules(id, day_of_week, start_time, end_time),
    lessons:class_lessons(${LESSON_COLUMNS})`;
const STUDENTS_SELECT = `students:class_students(joined_at, leaves_after,
    student:profiles!student_id(${PERSON}, contact_number, date_of_birth))`;

// `lesson` is not written here: it mirrors the latest row of class_lessons (see setClassLesson).
// `startsOn` ('yyyy-MM-dd') is optional: a class opening later takes students now and bills from then.
const CLASS_FIELDS = ({ name, instructorId, roomId, price, startsOn }) => ({
    name: name.trim(),
    instructor_id: instructorId,
    room_id: roomId || null,
    price: Number(price),
    ...(startsOn ? { starts_on: startsOn } : {}),
});

// Class lifecycle (supabase/migrations/20261114000100_class_lifecycle.sql): a class runs from
// `starts_on` to `ended_on` (null = still running). After its last day a daily job keeps its weekly
// schedule in `final_schedule`, frees the room and takes the students out; history stays.
// 'upcoming' (starts later) | 'running' | 'ending' (has a last day still ahead or today) | 'ended'.
export function classPhase(cls, today) {
    if (cls.ended_on && cls.ended_on < today) return 'ended';
    if (cls.starts_on && cls.starts_on > today) return 'upcoming';
    return cls.ended_on ? 'ending' : 'running';
}

// Public homepage data (anon allowed): includes instructor name/avatar without exposing profiles.
export async function listPublicClasses() {
    return unwrap(await supabase.rpc('list_public_classes'));
}

// Classes that haven't ended (running, ending, upcoming). { includeEnded: true } adds past classes.
async function selectClasses(columns, { includeEnded = false } = {}) {
    let query = supabase.from('classes').select(columns).order('name');
    if (!includeEnded) query = query.or(`ended_on.is.null,ended_on.gte.${await getStudioToday()}`);
    return unwrap(await query);
}

export async function listClasses(options) {
    return selectClasses(CLASS_SELECT, options);
}

export async function listClassesWithStudents(options) {
    return selectClasses(`${CLASS_SELECT}, ${STUDENTS_SELECT}`, options);
}

// One class with its members (any phase).
export async function getClass(id) {
    return unwrap(await supabase.from('classes').select(`${CLASS_SELECT}, ${STUDENTS_SELECT}`).eq('id', id).single());
}

// The class runs until `lastDay` ('yyyy-MM-dd', today or later). Months after it are cancelled
// right away; returns { class_id, ended_on, paid_after: [{ invoice_id, student_id, student_name,
// month, paid_amount }] } — students who already paid for a month it won't run (switch or refund them).
export async function endClass(classId, lastDay, reason = null) {
    return unwrap(await supabase.rpc('class_end', { p_class: classId, p_last_day: lastDay, p_reason: reason }));
}

// Undo an ending; the weekly sessions come back where the room is still free → { restored, skipped }.
export async function reopenClass(classId) {
    return unwrap(await supabase.rpc('class_reopen', { p_class: classId }));
}

export async function listInstructorClasses(instructorId) {
    return unwrap(
        await supabase
            .from('classes')
            .select(`${CLASS_SELECT}, ${STUDENTS_SELECT}`)
            .eq('instructor_id', instructorId)
            .order('name')
    );
}

// Guests can read their own enrolments; class details come from the public listing.
export async function listMyEnrolledClasses(studentId) {
    const enrolments = unwrap(
        await supabase.from('class_students').select('class_id, joined_at').eq('student_id', studentId)
    );
    if (enrolments.length === 0) return [];
    const publicClasses = await listPublicClasses();
    const joinedAt = new Map(enrolments.map((row) => [row.class_id, row.joined_at]));
    return publicClasses
        .filter((item) => joinedAt.has(item.id))
        .map((item) => ({ ...item, joined_at: joinedAt.get(item.id) }));
}

// Routines of the given classes (public read) with their video and promo, newest month first.
export async function listClassLessons(classIds) {
    if (classIds.length === 0) return [];
    return unwrap(
        await supabase
            .from('class_lessons')
            .select(LESSON_COLUMNS)
            .in('class_id', classIds)
            .order('month', { ascending: false })
    );
}

export async function createClass(fields, imageFile) {
    const created = unwrap(await supabase.from('classes').insert(CLASS_FIELDS(fields)).select(CLASS_SELECT).single());
    // The storage path needs the class id, so the image is attached after the insert.
    return imageFile ? setClassImage(created, imageFile) : created;
}

export async function updateClass(id, fields) {
    return unwrap(await supabase.from('classes').update(CLASS_FIELDS(fields)).eq('id', id).select(CLASS_SELECT).single());
}

export async function setClassImage(classRow, imageFile) {
    const path = await uploadClassImage(classRow.id, imageFile);
    let updated;
    try {
        updated = unwrap(
            await supabase.from('classes').update({ image_path: path }).eq('id', classRow.id).select(CLASS_SELECT).single()
        );
    } catch (error) {
        await removeFiles(BUCKETS.classImages, [path]);
        throw error;
    }
    if (classRow.image_path && classRow.image_path !== path) await removeFiles(BUCKETS.classImages, [classRow.image_path]);
    return updated;
}

// Only for a class created by mistake: one with history (completed sessions, marked roll calls,
// payments) is refused with IN_USE — end it instead (endClass).
export async function deleteClass(classRow) {
    unwrap(await supabase.from('classes').delete().eq('id', classRow.id));
    await removeFiles(BUCKETS.classImages, [classRow.image_path]);
}

// How many classes a user is enrolled in (a guest sees only their own rows).
export async function countMyEnrolments(studentId) {
    const { count, error } = await supabase
        .from('class_students')
        .select('class_id', { count: 'exact', head: true })
        .eq('student_id', studentId);
    if (error) throw error;
    return count ?? 0;
}

// Enrols a student now (billed for the running course: someone new pays for the sessions left), or from a
// later date (`joinedAt` 'yyyy-MM-dd' = a course's start: that course is billed in full, nothing earlier).
export async function addStudent(classId, studentId, { joinedAt } = {}) {
    const row = { class_id: classId, student_id: studentId };
    if (joinedAt) row.joined_at = joinedAt;
    unwrap(await supabase.from('class_students').insert(row));
}

export async function removeStudent(classId, studentId) {
    unwrap(await supabase.from('class_students').delete().eq('class_id', classId).eq('student_id', studentId));
}

// ---- Routines (class_lessons) ----------------------------------------------------
// A routine is the piece a class learns over `session_count` sessions from `starts_on`
// (supabase/migrations/20261115000100_routines.sql). `month` = first day of starts_on's month (kept for
// monthly views). classes.lesson mirrors the current routine automatically.

// Create (no id) or update a routine = a course (khoá): { id?, classId, title, startsOn 'yyyy-MM-dd', sessionCount,
// price } — `price` is the course fee (null / '' = the class price). Tuition is billed per course.
export async function saveRoutine({ id, classId, title, startsOn, sessionCount, price }) {
    const row = { title: title.trim() };
    if (startsOn) row.starts_on = startsOn;
    if (sessionCount) row.session_count = Number(sessionCount);
    if (price !== undefined) row.price = price === '' || price === null ? null : Number(price);
    const query = id
        ? supabase.from('class_lessons').update(row).eq('id', id)
        : supabase.from('class_lessons').insert({ class_id: classId, ...row });
    return unwrap(await query.select(LESSON_COLUMNS).single());
}

// Older monthly API: the routine starting in `month` ('yyyy-MM-01') gets this title (created on the 1st if missing).
export async function setClassLesson({ classId, month, title }) {
    const next = `${month.slice(0, 7)}-01`;
    const existing = unwrap(
        await supabase.from('class_lessons').select('id').eq('class_id', classId).eq('month', next).order('starts_on').limit(1)
    );
    return saveRoutine({ id: existing[0]?.id, classId, title, startsOn: existing[0] ? undefined : next });
}

// Progress of every routine of these classes: { lesson_id, class_id, title, starts_on, session_count,
// sessions_held, sessions_cancelled, next_session, ends_on (projected last session = shoot day; later when
// sessions are cancelled, earlier with a make-up), status: 'planned' | 'current' | 'done' | 'stopped' }.
export async function listLessonProgress(classIds) {
    if (classIds.length === 0) return [];
    return unwrap(await supabase.rpc('lesson_progress', { p_class_ids: classIds }));
}

// A one-off (make-up) session on `date` ('yyyy-MM-dd', today or later) with its own times ('HH:mm').
// It gets a roll call, counts for routines and, once completed, for payroll. SLOT_TAKEN when the room is busy;
// INVALID_STATE when the class already meets that day or doesn't run then.
export async function addMakeUpSession(classId, date, start, end, note = null) {
    return unwrap(await supabase.rpc('class_add_session', { p_class: classId, p_date: date, p_start: start, p_end: end, p_note: note }));
}

export async function setLessonVideo(id, videoUrl) {
    return unwrap(
        await supabase
            .from('class_lessons')
            .update({ video_url: videoUrl || null })
            .eq('id', id)
            .select('id, month, title, video_url')
            .single()
    );
}

// Class videos of the latest finished month that has any (public), normally last month:
// [{ id, class_id, month, title, video_url }]. Videos added to the running month wait for it to end.
export async function listLatestClassVideos() {
    const thisMonth = `${(await getStudioToday()).slice(0, 7)}-01`;
    const rows = unwrap(
        await supabase
            .from('class_lessons')
            .select('id, class_id, month, title, video_url')
            .not('video_url', 'is', null)
            .lt('month', thisMonth)
            .order('month', { ascending: false })
            .limit(40)
    );
    const month = rows[0]?.month;
    return rows.filter((row) => row.month === month);
}

// `routine` is a class_lessons row (or a progress row merged with it): its promo files go with it.
export async function deleteClassLesson(routine) {
    unwrap(await supabase.from('class_lessons').delete().eq('id', routine.id ?? routine.lesson_id));
    await removeFiles(PROMO_BUCKET, [routine.promo_path, routine.promo_poster_path]);
}
