// A class's maximum number of students (supabase/migrations/20261117003200_class_capacity.sql). A place counts from
// the day it is given until the student leaves (class_students with leaves_after null or today on), as the server
// counts them (private.class_places_taken).

// Places held among a class's class_students rows on `today` ('yyyy-MM-dd').
export const placesTaken = (students = [], today) => students.filter((row) => !row.leaves_after || (today && row.leaves_after >= today)).length;

// { max, taken, left, full } for a class with a maximum (`cls.max_students`, `cls.students` rows); null = no limit.
export function seatsOf(cls, today) {
    if (!cls?.max_students) return null;
    const taken = placesTaken(cls.students ?? [], today);
    return { max: cls.max_students, taken, left: Math.max(cls.max_students - taken, 0), full: taken >= cls.max_students };
}

// The maximum typed in a form: '' = no limit, else a whole number 1–500 (and not below `taken`).
export const MAX_STUDENTS_LIMIT = 500;
export function maxStudentsProblem(value, taken = 0) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > MAX_STUDENTS_LIMIT) return 'range';
    if (number < taken) return 'below';
    return null;
}
