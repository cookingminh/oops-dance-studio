import { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import { LuArrowUpToLine, LuCheck, LuCheckCheck, LuChevronLeft, LuChevronRight, LuListChecks, LuPlus, LuX } from 'react-icons/lu';
import { addDays, format, parseISO } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { generateStudentAttendance, listStudentAttendance, setStudentAttendanceStatus } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { toIsoDate } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';
import { fadeUp, stagger } from '../../../common/motion';
import { useStudioClock } from '../../../common/useStudioClock';
import { sessionTimes, useStaffTasks } from '../../../../tasks/staffTasks';
import placeholder from '@/assets/images/logo-mark.webp';

// One day's roll calls grouped by class, in timetable order (today when `day` is null).
async function loadDay(day) {
    const today = await getStudioToday();
    const date = day ?? today;
    const rows = await listStudentAttendance({ date });
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.class_id)) groups.set(row.class_id, { cls: row.class, rows: [] });
        groups.get(row.class_id).rows.push(row);
    }
    const list = [...groups.values()].map((group) => ({ ...group, ...sessionTimes(group.cls, date) }));
    list.sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
    return { date, today, groups: list };
}

const shiftDay = (isoDate, days) => toIsoDate(addDays(parseISO(isoDate), days));
const nameOf = (row) => row.student?.full_name || row.student?.username || '';

// Row order per class: unmarked students first, then the rest, each by name. It is taken when a
// day is opened (or on "Unmarked to top") and then kept, so a row never jumps away while you tap.
function buildOrder(data) {
    const byClass = new Map();
    for (const { cls, rows } of data.groups) {
        const sorted = [...rows].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || nameOf(a).localeCompare(nameOf(b)));
        byClass.set(cls.id, sorted.map((row) => row.id));
    }
    return { date: data.date, byClass };
}

function inOrder(rows, ids = []) {
    const rank = new Map(ids.map((id, index) => [id, index]));
    // Rows that appeared since the order was taken go last.
    return [...rows].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || nameOf(a).localeCompare(nameOf(b)));
}

function phaseOf({ start, end }, now, allMarked, isPast) {
    if (allMarked) return { label: 'Done', tone: 'good' };
    if (isPast) return { label: 'Not finished', tone: 'alert' };
    if (end && now >= end) return { label: 'Class ended', tone: 'alert' };
    if (start && now >= start) return { label: 'In class now', tone: 'live' };
    return { label: start ? `Starts at ${start}` : 'Today', tone: 'idle' };
}

// Mark each student as attended or absent, one tap per student. Defaults to today; the arrows
// go back to earlier days to check or correct a past roll call.
const StudentAttendance = ({ onChanged }) => {
    const toast = useToast();
    const [day, setDay] = useState(null); // null = today
    const roll = useAsync(() => loadDay(day), [day]);
    const { refresh: refreshTasks } = useStaffTasks();
    const now = useStudioClock();
    const [generating, setGenerating] = useState(false);
    const [busy, setBusy] = useState(null); // row id or `class-<id>`
    const [order, setOrder] = useState(null);

    // A newly opened day gets a fresh "unmarked first" order (state adjusted during render).
    if (roll.data && order?.date !== roll.data.date) setOrder(buildOrder(roll.data));

    const afterChange = () => {
        roll.reload();
        refreshTasks();
        onChanged?.();
    };

    const mark = async (row, status) => {
        if (row.status === status) return;
        setBusy(row.id);
        try {
            await setStudentAttendanceStatus(row.id, status);
            afterChange();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const markAllAttended = async (group) => {
        setBusy(`class-${group.cls.id}`);
        try {
            await Promise.all(group.rows.filter((row) => row.status === 'pending').map((row) => setStudentAttendanceStatus(row.id, 'attend')));
            toast.success(`Everyone left in ${group.cls.name} is marked as attended.`);
            afterChange();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const created = await generateStudentAttendance();
            toast.success(created > 0 ? `Created ${created} attendance records for today.` : 'Today’s records already exist.');
            afterChange();
        } catch (error) {
            toast.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const groups = roll.data?.groups ?? [];
    const viewing = roll.data?.date;
    const isToday = Boolean(roll.data) && viewing === roll.data.today;
    const isPast = Boolean(roll.data) && viewing < roll.data.today;
    const goTo = (date) => setDay(date === roll.data?.today ? null : date);
    const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
    const marked = groups.reduce((sum, group) => sum + group.rows.filter((row) => row.status !== 'pending').length, 0);

    return (
        <SectionCard
            icon={LuListChecks}
            title={roll.data && !isToday ? 'Student attendance' : 'Student Attendance Today'}
            subtitle={
                viewing
                    ? `${format(parseISO(viewing), 'EEEE d MMMM')} · ${marked} of ${total} students marked`
                    : 'Mark each student as attended or absent'
            }
            actions={
                <>
                    <div className="dayNav" role="group" aria-label="Choose a day">
                        <button type="button" aria-label="Previous day" disabled={!viewing} onClick={() => goTo(shiftDay(viewing, -1))}>
                            <LuChevronLeft />
                        </button>
                        <input
                            type="date"
                            aria-label="Day"
                            value={viewing ?? ''}
                            max={roll.data?.today}
                            onChange={(event) => event.target.value && goTo(event.target.value)}
                        />
                        <button type="button" aria-label="Next day" disabled={!viewing || isToday} onClick={() => goTo(shiftDay(viewing, 1))}>
                            <LuChevronRight />
                        </button>
                    </div>
                    {isToday ? (
                        <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} onPress={handleGenerate} isLoading={generating}>
                            Create today’s records
                        </Button>
                    ) : (
                        <Button variant="flat" onPress={() => setDay(null)} isDisabled={!roll.data}>
                            Back to today
                        </Button>
                    )}
                </>
            }
        >
            <AsyncState
                state={roll}
                isEmpty={groups.length === 0}
                emptyText={
                    isToday || !roll.data
                        ? 'No attendance records for today. Classes scheduled today get records when you create them.'
                        : 'No roll calls on this day.'
                }
            >
                <motion.div key={viewing} className="rollCallGrid" variants={stagger} initial="hidden" animate="show">
                    {groups.map((group) => {
                        const { cls, start, end } = group;
                        const rows = inOrder(group.rows, order?.byClass.get(cls.id));
                        // Some unmarked student sits below a marked one: offer to re-sort.
                        const firstMarked = rows.findIndex((row) => row.status !== 'pending');
                        const canResort = firstMarked !== -1 && rows.slice(firstMarked).some((row) => row.status === 'pending');
                        const done = rows.filter((row) => row.status !== 'pending').length;
                        const attended = rows.filter((row) => row.status === 'attend').length;
                        const percent = rows.length ? Math.round((done / rows.length) * 100) : 0;
                        const phase = phaseOf(group, now, done === rows.length, isPast);
                        const instructor = cls.instructor?.full_name || cls.instructor?.username;
                        return (
                            <motion.section key={cls.id} variants={fadeUp} className={`rollCall tone-${phase.tone}`} aria-label={cls.name}>
                                <header className="rollCallHead">
                                    <img src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
                                    <div className="rollCallTitle">
                                        <h3>
                                            {cls.name}
                                            {instructor && <span className="rollCallInstructor"> · {instructor}</span>}
                                        </h3>
                                        <p>
                                            {start && `${start}–${end}`}
                                            {cls.room?.name && ` · ${cls.room.name}`} · {done} of {rows.length} marked · {attended} attended
                                        </p>
                                    </div>
                                    <span className={`phaseBadge tone-${phase.tone}`}>
                                        {phase.tone === 'live' && <span className="livePulse" aria-hidden="true" />}
                                        {phase.label}
                                    </span>
                                </header>

                                <div className="rollProgress" role="progressbar" aria-label={`${cls.name}: attendance marked`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                                    <span style={{ width: `${percent}%` }} />
                                </div>

                                <ul className="rosterList">
                                    {rows.map((row) => {
                                        const name = row.student?.full_name || row.student?.username || 'Student';
                                        return (
                                            <li key={row.id} className={`rosterRow is-${row.status}`}>
                                                <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(row.student?.avatar_path, row.student?.updated_at) ?? undefined} name={name} />
                                                <span className="rosterName">
                                                    <strong>{name}</strong>
                                                    <span>{row.student?.contact_number || row.student?.email}</span>
                                                </span>
                                                <span className="rosterToggle" role="group" aria-label={`${name}: attendance`}>
                                                    <button
                                                        type="button"
                                                        className="isAbsent"
                                                        aria-pressed={row.status === 'absent'}
                                                        aria-label="Mark absent"
                                                        disabled={busy === row.id}
                                                        onClick={() => mark(row, 'absent')}
                                                    >
                                                        <LuX aria-hidden="true" /> <span>Absent</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="isAttend"
                                                        aria-pressed={row.status === 'attend'}
                                                        aria-label="Mark attended"
                                                        disabled={busy === row.id}
                                                        onClick={() => mark(row, 'attend')}
                                                    >
                                                        <LuCheck aria-hidden="true" /> <span>Attended</span>
                                                    </button>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <footer className="rollCallFoot">
                                    {canResort && (
                                        <Button
                                            size="sm"
                                            variant="light"
                                            startContent={<LuArrowUpToLine aria-hidden="true" />}
                                            onPress={() => setOrder(buildOrder(roll.data))}
                                        >
                                            Unmarked to top
                                        </Button>
                                    )}
                                    {done < rows.length ? (
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            color="success"
                                            startContent={<LuCheckCheck aria-hidden="true" />}
                                            isLoading={busy === `class-${cls.id}`}
                                            onPress={() => markAllAttended(group)}
                                        >
                                            Mark everyone left as attended
                                        </Button>
                                    ) : (
                                        <span className="rollCallDone">
                                            <LuCheckCheck aria-hidden="true" /> All {rows.length} marked
                                        </span>
                                    )}
                                </footer>
                            </motion.section>
                        );
                    })}
                </motion.div>
            </AsyncState>
        </SectionCard>
    );
};

export default StudentAttendance;
