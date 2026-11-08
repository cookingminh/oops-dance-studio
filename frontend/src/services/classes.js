import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { BUCKETS, removeFiles, uploadClassImage } from './storage';

// Column hints (!instructor_id, !room_id, …) are required: classes and profiles are also linked
// through class_students / attendance, so PostgREST can't pick the relationship on its own.
const PERSON = 'id, username, full_name, email, avatar_path, updated_at';
const CLASS_SELECT = `id, name, price, lesson, image_path, instructor_id, room_id, created_at,
    instructor:profiles!instructor_id(${PERSON}),
    room:rooms!room_id(id, name, size),
    schedules:class_schedules(id, day_of_week, start_time, end_time)`;
const STUDENTS_SELECT = `students:class_students(joined_at,
    student:profiles!student_id(${PERSON}, contact_number, date_of_birth))`;

const CLASS_FIELDS = ({ name, instructorId, roomId, price, lesson }) => ({
    name: name.trim(),
    instructor_id: instructorId,
    room_id: roomId || null,
    price: Number(price),
    lesson: lesson?.trim() || null,
});

// Public homepage data (anon allowed): includes instructor name/avatar without exposing profiles.
export async function listPublicClasses() {
    return unwrap(await supabase.rpc('list_public_classes'));
}

export async function listClasses() {
    return unwrap(await supabase.from('classes').select(CLASS_SELECT).order('name'));
}

export async function listClassesWithStudents() {
    return unwrap(await supabase.from('classes').select(`${CLASS_SELECT}, ${STUDENTS_SELECT}`).order('name'));
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

// Cascades to schedules, enrolments and attendance.
export async function deleteClass(classRow) {
    unwrap(await supabase.from('classes').delete().eq('id', classRow.id));
    await removeFiles(BUCKETS.classImages, [classRow.image_path]);
}

export async function addStudent(classId, studentId) {
    unwrap(await supabase.from('class_students').insert({ class_id: classId, student_id: studentId }));
}

export async function removeStudent(classId, studentId) {
    unwrap(await supabase.from('class_students').delete().eq('class_id', classId).eq('student_id', studentId));
}
