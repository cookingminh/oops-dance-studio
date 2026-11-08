import { sessionTimes } from '../../../../tasks/staffTasks';

// Where a session stands right now, for today's cards: label + tone for the badge.
// tone: 'good' | 'live' | 'alert' | 'idle' | 'muted'
export function sessionPhase(record, now) {
    const { start, end } = sessionTimes(record.class, record.date);
    switch (record.status) {
        case 'completed':
            return { label: 'Done', tone: 'good' };
        case 'cancelled':
            return { label: 'Cancelled', tone: 'muted' };
        case 'in_progress':
            return end && now >= end ? { label: 'Not checked out', tone: 'alert' } : { label: 'Teaching now', tone: 'live' };
        default:
            return start && now >= start ? { label: 'Not checked in', tone: 'alert' } : { label: start ? `Starts at ${start}` : 'Not started', tone: 'idle' };
    }
}

export const OPEN_STATUSES = ['pending', 'waiting', 'in_progress'];
