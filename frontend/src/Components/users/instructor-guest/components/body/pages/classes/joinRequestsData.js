import { getStudioToday } from '@/services/studio';
import { listPublicClasses } from '@/services/classes';
import { listMyJoinRequests } from '@/services/classJoin';

// The student's requests to join a class, as "Your requests" on My classes shows them:
//   every request still waiting, a "yes" for a week after it, a "no" (or their own cancel) for a month.
// Each row is a listMyJoinRequests() row plus `teacher` / `teacherAvatar` from the public listing (RLS hides other
// profiles from students; a class that has ended is no longer listed, so it has no teacher here).
// → { today, requests } — waiting first (newest first), then the answers (newest first).

const DAY = 864e5;
const KEEP_DAYS = { approved: 7, declined: 30, cancelled: 30 };

const answeredAt = (row) => new Date(row.decided_at ?? row.updated_at).getTime();

export async function loadMyJoinRequests() {
    const [today, requests, classes] = await Promise.all([getStudioToday(), listMyJoinRequests(), listPublicClasses().catch(() => [])]);
    const listed = new Map(classes.map((cls) => [cls.id, cls]));
    const now = Date.now();
    const shown = requests.filter((row) => row.status === 'pending' || (KEEP_DAYS[row.status] && now - answeredAt(row) <= KEEP_DAYS[row.status] * DAY));
    const waiting = shown.filter((row) => row.status === 'pending');
    const answered = shown.filter((row) => row.status !== 'pending').sort((a, b) => answeredAt(b) - answeredAt(a));
    return {
        today,
        requests: [...waiting, ...answered].map((row) => ({
            ...row,
            teacher: listed.get(row.class_id)?.instructor_name ?? null,
            teacherAvatar: listed.get(row.class_id)?.instructor_avatar_path ?? null,
        })),
    };
}
