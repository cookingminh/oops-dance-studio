import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import { LuAlertTriangle } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { formatClock } from '@/lib/format';
import { avatarUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SectionCard from '../../../common/SectionCard';
import { sessionTimes } from '../../../../tasks/staffTasks';

// Past sessions nobody closed: the instructor never checked in, or never checked out.
const ReviewQueue = ({ rows, actions }) => (
    <SectionCard
        className="reviewCard"
        icon={LuAlertTriangle}
        title="Needs your review"
        subtitle={`${rows.length} past session${rows.length === 1 ? ' was' : 's were'} never closed. Mark completed if the class happened, cancel it if not.`}
    >
        <ul className="reviewList">
            <AnimatePresence initial={false}>
                {rows.map((row) => {
                    const name = row.instructor?.full_name || row.instructor?.username || 'Instructor';
                    const { start, end } = sessionTimes(row.class, row.date);
                    const missing = row.status === 'in_progress' ? `Checked in ${formatClock(row.checkin_at)}, never checked out` : 'No check-in';
                    return (
                        <motion.li key={row.id} layout exit={{ opacity: 0, x: 32 }} transition={{ duration: 0.25 }} className="reviewItem">
                            <span className="reviewDate">
                                <strong>{format(parseISO(row.date), 'd')}</strong>
                                <small>{format(parseISO(row.date), 'MMM')}</small>
                            </span>
                            <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(row.instructor?.avatar_path, row.instructor?.updated_at) ?? undefined} name={name} />
                            <span className="reviewText">
                                <strong>
                                    {name} · {row.class?.name}
                                </strong>
                                <span>
                                    {format(parseISO(row.date), 'EEEE')} {start}–{end} · <em>{missing}</em>
                                </span>
                            </span>
                            <span className="reviewActions">
                                <Button size="sm" variant="light" color="danger" onPress={() => actions.cancel(row)} isDisabled={actions.busyId === row.id}>
                                    Cancel session
                                </Button>
                                <Button size="sm" color="success" className="text-white" onPress={() => actions.approve(row)} isLoading={actions.busyId === row.id}>
                                    Mark completed
                                </Button>
                            </span>
                        </motion.li>
                    );
                })}
            </AnimatePresence>
        </ul>
    </SectionCard>
);

export default ReviewQueue;
