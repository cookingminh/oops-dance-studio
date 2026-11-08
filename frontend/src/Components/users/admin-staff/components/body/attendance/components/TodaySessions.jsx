import { motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import { LuCalendarDays, LuCalendarPlus, LuCheck, LuInfo } from 'react-icons/lu';
import { formatClock, formatDate } from '@/lib/format';
import { avatarUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';
import { fadeUp, stagger } from '../../../common/motion';
import { useStudioClock } from '../../../common/useStudioClock';
import { sessionTimes } from '../../../../tasks/staffTasks';
import { AttendanceMenu, NoteButton, ProofThumb } from './AttendanceParts';
import { OPEN_STATUSES, sessionPhase } from './sessionPhase';

const Step = ({ label, at, proof, onView }) => (
    <li className={`sessionStep${at ? ' isDone' : ''}`}>
        <span className="stepDot" aria-hidden="true">{at && <LuCheck />}</span>
        <span className="stepText">
            <small>{label}</small>
            <strong>{at ? formatClock(at) : 'Not yet'}</strong>
        </span>
        <ProofThumb url={proof} label={`${label} proof`} onView={onView} />
    </li>
);

// Today's sessions as cards: who teaches, when, and how far they are (check-in → check-out).
const TodaySessions = ({ state, today, rows, missingCount, actions, onGenerate, generating }) => {
    const now = useStudioClock();
    const sessions = [...rows].sort((a, b) => sessionTimes(a.class, a.date).start.localeCompare(sessionTimes(b.class, b.date).start));
    const done = sessions.filter((row) => row.status === 'completed').length;

    return (
        <SectionCard
            className="todaySessionsCard"
            icon={LuCalendarDays}
            title="Today’s sessions"
            subtitle={today ? `${formatDate(today)} · ${done} of ${sessions.length} done` : 'Loading today…'}
            actions={
                <Button variant="flat" startContent={<LuCalendarPlus aria-hidden="true" />} onPress={onGenerate} isLoading={generating}>
                    Create this week’s records
                </Button>
            }
        >
            {missingCount > 0 && (
                <p className="inlineNotice">
                    <LuInfo aria-hidden="true" />
                    {missingCount} class{missingCount === 1 ? '' : 'es'} on today’s timetable {missingCount === 1 ? 'has' : 'have'} no record yet. Create this week’s records to add {missingCount === 1 ? 'it' : 'them'}.
                </p>
            )}
            <AsyncState state={state} isEmpty={sessions.length === 0} emptyText="No sessions scheduled today.">
                <motion.div className="sessionGrid" variants={stagger} initial="hidden" animate="show">
                    {sessions.map((row) => {
                        const { start, end } = sessionTimes(row.class, row.date);
                        const phase = sessionPhase(row, now);
                        const name = row.instructor?.full_name || row.instructor?.username || 'Instructor';
                        return (
                            <motion.article key={row.id} variants={fadeUp} className={`sessionCard tone-${phase.tone}`}>
                                <header className="sessionTop">
                                    <span className="sessionTime">
                                        <strong>{start}</strong> – {end}
                                    </span>
                                    <span className={`phaseBadge tone-${phase.tone}`}>
                                        {phase.tone === 'live' && <span className="livePulse" aria-hidden="true" />}
                                        {phase.label}
                                    </span>
                                </header>
                                <div className="sessionWho">
                                    <Avatar {...AVATAR_DEFAULTS} src={avatarUrl(row.instructor?.avatar_path, row.instructor?.updated_at) ?? undefined} name={name} />
                                    <div>
                                        <strong>{name}</strong>
                                        <span>
                                            {row.class?.name}
                                            {row.room?.name && ` · ${row.room.name}`}
                                        </span>
                                    </div>
                                </div>
                                <ol className="sessionSteps">
                                    <Step label="Check-in" at={row.checkin_at} proof={row.checkin_proof_url} onView={actions.viewProof} />
                                    <Step label="Check-out" at={row.checkout_at} proof={row.checkout_proof_url} onView={actions.viewProof} />
                                </ol>
                                <footer className="sessionActions">
                                    <NoteButton record={row} />
                                    {OPEN_STATUSES.includes(row.status) && phase.tone === 'alert' && (
                                        <Button size="sm" variant="flat" color="success" onPress={() => actions.approve(row)} isLoading={actions.busyId === row.id}>
                                            Mark completed
                                        </Button>
                                    )}
                                    <AttendanceMenu record={row} actions={actions} />
                                </footer>
                            </motion.article>
                        );
                    })}
                </motion.div>
            </AsyncState>
        </SectionCard>
    );
};

export default TodaySessions;
