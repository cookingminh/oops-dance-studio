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
    LuLandmark,
    LuListChecks,
    LuLogIn,
    LuLogOut,
    LuMusic,
    LuPartyPopper,
    LuReceipt,
    LuRefreshCw,
    LuRepeat,
    LuTicket,
} from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useStaffTasks } from '../../tasks/staffTasks';

const ICONS = {
    review: LuClipboardCheck,
    checkin: LuLogIn,
    checkout: LuLogOut,
    generate: LuCalendarPlus,
    students: LuListChecks,
    bookings: LuTicket,
    lessons: LuMusic,
    tuition: LuReceipt,
    transfers: LuLandmark,
    renewals: LuRepeat,
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
    const { t, tn, formatDate, monthName } = useI18n();

    // A task message is { key, vars } (English key) or { text } (data, shown as is).
    const say = (message) => {
        if (!message) return '';
        if (message.text !== undefined) return message.text;
        const vars = { ...message.vars };
        if ('who' in vars) vars.who = vars.who ?? t('An instructor');
        if (vars.date) vars.date = formatDate(vars.date, 'short');
        if (vars.month) vars.month = monthName(vars.month);
        return t(message.key, vars);
    };

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
                    aria-label={tasks.length ? t('Notifications: {count} to do', { count: tasks.length }) : t('Notifications: nothing to do')}
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
                        <strong>{t('Notifications')}</strong>
                        <span>
                            {tasks.length
                                ? `${tn(tasks.length, '{count} thing needs you', '{count} things need you')}${urgent ? ` · ${t('{count} urgent', { count: urgent })}` : ''}`
                                : t('Nothing needs you right now')}
                        </span>
                    </div>
                    <button type="button" className="taskRefresh" onClick={refresh} aria-label={t('Refresh notifications')} disabled={loading}>
                        <LuRefreshCw className={loading ? 'isSpinning' : undefined} />
                    </button>
                </div>

                {tasks.length === 0 ? (
                    <div className="taskEmpty">
                        <span className="taskEmptyIcon" aria-hidden="true">
                            <LuPartyPopper />
                        </span>
                        <strong>{t('You’re all caught up')}</strong>
                        <span>{t('New requests, missed check-ins and tuition to collect will show up here.')}</span>
                    </div>
                ) : (
                    <div className="taskScroll">
                        {GROUPS.map(({ tone, label }) => {
                            const group = tasks.filter((task) => task.tone === tone);
                            if (group.length === 0) return null;
                            return (
                                <section key={tone} className="taskGroup">
                                    <h3>{t(label)}</h3>
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
                                                            <strong>{say(task.title)}</strong>
                                                            <span>{say(task.detail)}</span>
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
                    {data?.checkedAt ? t('Updated {time} · refreshes every minute', { time: data.checkedAt }) : t('Checking…')}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default TaskBell;
