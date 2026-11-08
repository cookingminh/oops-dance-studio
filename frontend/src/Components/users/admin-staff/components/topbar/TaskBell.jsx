import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react';
import {
    LuBell,
    LuCalendarPlus,
    LuChevronRight,
    LuClock,
    LuClipboardCheck,
    LuListChecks,
    LuLogIn,
    LuLogOut,
    LuMusic,
    LuPartyPopper,
    LuRefreshCw,
    LuTicket,
} from 'react-icons/lu';
import { useStaffTasks } from '../../tasks/staffTasks';

const ICONS = {
    review: LuClipboardCheck,
    checkin: LuLogIn,
    checkout: LuLogOut,
    generate: LuCalendarPlus,
    students: LuListChecks,
    bookings: LuTicket,
    lessons: LuMusic,
};

const GROUPS = [
    { tone: 'urgent', label: 'Needs attention now' },
    { tone: 'normal', label: 'To do today' },
    { tone: 'later', label: 'Later today' },
];

// Bell in the top bar: how many things need attention, and the list of them.
const TaskBell = () => {
    const navigate = useNavigate();
    const { data, loading, refresh } = useStaffTasks();
    const [open, setOpen] = useState(false);
    const tasks = data?.tasks ?? [];
    const urgent = tasks.filter((task) => task.tone === 'urgent').length;

    const go = (task) => {
        setOpen(false);
        navigate(task.to);
    };

    return (
        <Popover placement="bottom-end" offset={12} isOpen={open} onOpenChange={setOpen} classNames={{ base: 'taskPopover' }}>
            <PopoverTrigger>
                <button
                    type="button"
                    className={`iconButton taskBell${urgent ? ' hasUrgent' : ''}`}
                    aria-label={tasks.length ? `Notifications: ${tasks.length} to do` : 'Notifications: nothing to do'}
                >
                    <LuBell />
                    <AnimatePresence>
                        {tasks.length > 0 && (
                            <motion.span
                                key={tasks.length}
                                className="bellBadge"
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.4, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                            >
                                {tasks.length > 9 ? '9+' : tasks.length}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </PopoverTrigger>
            <PopoverContent className="taskPanel adminPortal">
                <div className="taskPanelHeader">
                    <span className={`taskHeaderIcon${urgent ? ' isUrgent' : ''}`} aria-hidden="true">
                        <LuBell />
                    </span>
                    <div className="taskHeaderText">
                        <strong>Notifications</strong>
                        <span>
                            {tasks.length
                                ? `${tasks.length} thing${tasks.length === 1 ? '' : 's'} need${tasks.length === 1 ? 's' : ''} you${urgent ? ` · ${urgent} urgent` : ''}`
                                : 'Nothing needs you right now'}
                        </span>
                    </div>
                    <button type="button" className="taskRefresh" onClick={refresh} aria-label="Refresh notifications" disabled={loading}>
                        <LuRefreshCw className={loading ? 'isSpinning' : undefined} />
                    </button>
                </div>

                {tasks.length === 0 ? (
                    <div className="taskEmpty">
                        <span className="taskEmptyIcon" aria-hidden="true">
                            <LuPartyPopper />
                        </span>
                        <strong>You’re all caught up</strong>
                        <span>New requests and missed check-ins will show up here.</span>
                    </div>
                ) : (
                    <div className="taskScroll">
                        {GROUPS.map(({ tone, label }) => {
                            const group = tasks.filter((task) => task.tone === tone);
                            if (group.length === 0) return null;
                            return (
                                <section key={tone} className="taskGroup">
                                    <h3>{label}</h3>
                                    <ul>
                                        {group.map((task) => {
                                            const Icon = ICONS[task.kind] ?? LuClipboardCheck;
                                            return (
                                                <li key={task.id}>
                                                    <button type="button" className={`taskItem is-${task.tone}`} onClick={() => go(task)}>
                                                        <span className={`taskIcon kind-${task.kind}`} aria-hidden="true">
                                                            <Icon />
                                                        </span>
                                                        <span className="taskText">
                                                            <strong>{task.title}</strong>
                                                            <span>{task.detail}</span>
                                                        </span>
                                                        <LuChevronRight className="taskChevron" aria-hidden="true" />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            );
                        })}
                    </div>
                )}

                <div className="taskPanelFooter">
                    <LuClock aria-hidden="true" />
                    {data?.checkedAt ? `Updated ${data.checkedAt} · refreshes every minute` : 'Checking…'}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default TaskBell;
