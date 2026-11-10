import { addDays, parseISO, subDays } from 'date-fns';
import { getStudioToday } from '@/services/studio';
import { listClassLessons, listInstructorClasses, listLessonProgress, listMyEnrolledClasses } from '@/services/classes';
import { listMyInstructorAttendance, listMyStudentAttendance, listStudentAttendanceForClasses } from '@/services/attendance';
import { listMakeUpSessions, withOwnTimes } from '@/services/sessions';
import { getTuitionSettings } from '@/services/tuition';
import { avatarUrl } from '@/services/storage';
import { promoFields } from '@/services/promos';
import { toIsoDate } from '@/lib/format';

// Both roles' classes in one shape, so the class views don't care who is looking:
//   { id, name, image_path, instructorName, instructorAvatar, roomName, schedules, lessons,
//     routines (lesson_progress rows + video_url and promo_*: the routine now, next and before),
//     joinedAt?, attendance? (student: own roll calls),
//     students? ({ …profile, joinedAt, leavesAfter }), rollCalls?, todaySession?,
//     makeUps? (instructor: make-up sessions this coming week),
//     renewalOpensAt? (instructor: sessions left when the next course's renewal opens, null = unknown) }

// Progress rows of one class with each routine's class video and promo clip.
const routinesOf = (progress, lessons, classId) => {
    const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    return progress
        .filter((row) => row.class_id === classId)
        .map((row) => ({ ...row, id: row.lesson_id, video_url: byId.get(row.lesson_id)?.video_url ?? null, ...promoFields(byId.get(row.lesson_id)) }));
};

const byName = (a, b) => (a.full_name || a.username).localeCompare(b.full_name || b.username, 'vi');

// Student: enrolments come from the public listing (RLS hides other profiles), lessons and the
// student's own roll calls are read directly.
export async function loadStudentClasses(userId) {
    const [today, classes, attendance] = await Promise.all([getStudioToday(), listMyEnrolledClasses(userId), listMyStudentAttendance(userId)]);
    const ids = classes.map((cls) => cls.id);
    // Routines are newer: without their progress the classes still show.
    const [lessons, progress] = await Promise.all([listClassLessons(ids), listLessonProgress(ids).catch(() => [])]);
    return {
        today,
        attendance,
        classes: classes.map((cls) => ({
            id: cls.id,
            name: cls.name,
            image_path: cls.image_path,
            instructorName: cls.instructor_name,
            instructorAvatar: avatarUrl(cls.instructor_avatar_path),
            roomName: cls.room_name,
            schedules: cls.schedules ?? [],
            lessons: lessons.filter((lesson) => lesson.class_id === cls.id),
            routines: routinesOf(progress, lessons, cls.id),
            joinedAt: cls.joined_at,
            attendance: attendance.filter((row) => row.class?.id === cls.id),
        })),
    };
}

// Instructor: own classes with students, the last 90 days of roll calls, today's sessions
// (instructor_attendance rows, for one-tap check-in; make-ups with their own times), the make-up
// sessions of the coming week and every routine's progress.
export async function loadInstructorClasses(userId) {
    const [today, classes, renewalOpensAt] = await Promise.all([
        getStudioToday(),
        listInstructorClasses(userId),
        // When the next course's renewal opens: the promo is due before then (PromoCard).
        getTuitionSettings()
            .then((settings) => settings?.renewal_open_sessions ?? null)
            .catch(() => null),
    ]);
    const ids = classes.map((cls) => cls.id);
    const [sessions, rollCalls, makeUps, progress] = await Promise.all([
        listMyInstructorAttendance(userId, { date: today }).then(withOwnTimes),
        listStudentAttendanceForClasses(ids, { from: toIsoDate(subDays(parseISO(today), 90)), until: today }),
        listMakeUpSessions(ids, { from: today, until: toIsoDate(addDays(parseISO(today), 7)) }).catch(() => []),
        listLessonProgress(ids).catch(() => []),
    ]);
    return {
        today,
        sessions,
        classes: classes.map((cls) => ({
            id: cls.id,
            name: cls.name,
            image_path: cls.image_path,
            instructorName: cls.instructor?.full_name || cls.instructor?.username,
            instructorAvatar: avatarUrl(cls.instructor?.avatar_path, cls.instructor?.updated_at),
            roomName: cls.room?.name,
            schedules: cls.schedules ?? [],
            lessons: cls.lessons ?? [],
            routines: routinesOf(progress, cls.lessons ?? [], cls.id),
            renewalOpensAt,
            makeUps: makeUps.filter((row) => row.class_id === cls.id),
            // Members with when they join (may be later) and their last day, if they are leaving.
            students: (cls.students ?? [])
                .filter((row) => row.student)
                .map((row) => ({ ...row.student, joinedAt: row.joined_at, leavesAfter: row.leaves_after ?? null }))
                .sort(byName),
            rollCalls: rollCalls.filter((row) => row.class_id === cls.id),
            todaySession: sessions.find((row) => row.class_id === cls.id) ?? null,
        })),
    };
}
