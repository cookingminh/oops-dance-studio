import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react';
import { LuBell, LuCalendarOff, LuCalendarPlus, LuChevronRight, LuPartyPopper, LuQrCode, LuReceipt, LuRepeat, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { changeWords } from '../../admin-staff/components/common/session-changes/changeText';
import { duesText } from './duesText';
import { useMyDues } from './myDuesContext';
import { changeKey, markSeen, readSeen } from './seenChanges';
import DuePay from './DuePay';
import './dues.scss';

const ICONS = { tuition: LuReceipt, renewal: LuRepeat, deposit: LuTicket, room: LuTicket };
const KIND_CLASS = { tuition: 'kind-tuition', renewal: 'kind-renewals', deposit: 'kind-bookings', room: 'kind-bookings' };
const CHANGE_ICONS = { cancelled: LuCalendarOff, make_up: LuCalendarPlus };
const GROUPS = [
    { tone: 'late', label: 'Overdue' },
    { tone: 'soon', label: 'Due in the next few days' },
    { tone: 'due', label: 'Coming up' },
];

// The bell's name for screen readers: what is waiting, in words.
function bellLabel(pay, fresh, { t, tn }) {
    if (pay && fresh) return tn(fresh, 'Notifications: {pay} to pay or answer, {count} schedule change', 'Notifications: {pay} to pay or answer, {count} schedule changes', { pay });
    if (fresh) return tn(fresh, 'Notifications: {count} schedule change', 'Notifications: {count} schedule changes');
    if (pay) return t('Notifications: {count} to pay or answer', { count: pay });
    return t('Notifications: nothing new');
}

// /profile top bar: the signed-in student's, guest's or teacher's notifications. Changes to their classes'
// schedule ahead (a session called off, a make-up; the row opens the class) count in the badge until the
// bell is opened; then what they still have to pay or answer, each with a QR button that opens the payment
// right here (the same look as the staff to-do bell).
const DuesBell = () => {
    const i18n = useI18n();
    const { t, tn } = i18n;
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data, refresh } = useMyDues();
    const [open, setOpen] = useState(false);
    const [paying, setPaying] = useState(null);
    const [seen, setSeen] = useState(() => (user ? readSeen(user.id) : new Set()));
    const [fresh, setFresh] = useState(() => new Set()); // the changes that were new when the bell opened
    const items = data?.items ?? [];
    const changes = data?.changes ?? [];
    const unseen = changes.filter((change) => !seen.has(changeKey(change)));
    const count = items.length + unseen.length;
    const late = items.filter((item) => item.tone === 'late').length;

    // Opening the bell shows the changes: they stop counting (and are marked "New" this once).
    const toggle = (next) => {
        setOpen(next);
        if (!next || !user) return;
        setFresh(new Set(unseen.map(changeKey)));
        markSeen(user.id, changes);
        setSeen(new Set(changes.map(changeKey)));
    };
    const openClass = (change) => {
        setOpen(false);
        navigate(`/profile/my-classes?class=${change.class_id}`);
    };
    const summary = [
        items.length ? tn(items.length, '{count} thing to pay or answer', '{count} things to pay or answer') : null,
        changes.length ? tn(changes.length, '{count} schedule change', '{count} schedule changes') : null,
    ].filter(Boolean).join(' · ');

    const go = (item) => {
        setOpen(false);
        navigate(item.to);
    };
    const pay = (item) => {
        setOpen(false);
        setPaying(item);
    };

    return (
        <>
            <Popover placement="bottom-end" offset={12} isOpen={open} onOpenChange={toggle} classNames={{ base: 'taskPopover' }}>
                <PopoverTrigger>
                    <button type="button" className={`iconButton taskBell${late ? ' hasUrgent' : ''}`} aria-label={bellLabel(items.length, unseen.length, i18n)}>
                        <LuBell />
                        <AnimatePresence>
                            {count > 0 && (
                                <motion.span
                                    key={count}
                                    className="bellBadge"
                                    initial={{ scale: 0.4, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.4, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                >
                                    {count > 9 ? '9+' : count}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="taskPanel duesPanel adminPortal">
                    <div className="taskPanelHeader">
                        <span className={`taskHeaderIcon${late ? ' isUrgent' : ''}`} aria-hidden="true">
                            <LuBell />
                        </span>
                        <div className="taskHeaderText">
                            <strong>{t('Notifications')}</strong>
                            <span>{summary || t('Nothing new right now')}</span>
                        </div>
                    </div>

                    {items.length === 0 && changes.length === 0 ? (
                        <div className="taskEmpty">
                            <span className="taskEmptyIcon" aria-hidden="true">
                                <LuPartyPopper />
                            </span>
                            <strong>{t('All paid up. Thank you!')}</strong>
                            <span>{t('Payments and changes to your class schedule will show up here.')}</span>
                        </div>
                    ) : (
                        <div className="taskScroll">
                            {changes.length > 0 && (
                                <section className="taskGroup duesChanges">
                                    <h3>{t('Schedule changes')}</h3>
                                    <ul>
                                        {changes.map((change) => {
                                            const Icon = CHANGE_ICONS[change.kind] ?? LuCalendarOff;
                                            const words = changeWords(change, i18n);
                                            const isNew = fresh.has(changeKey(change));
                                            return (
                                                <li key={changeKey(change)} className="duesRow">
                                                    <button type="button" className="taskItem" onClick={() => openClass(change)}>
                                                        <span className={`taskIcon kind-changes is-${change.kind}`} aria-hidden="true">
                                                            <Icon />
                                                        </span>
                                                        <span className="taskText">
                                                            <strong>{words.title}</strong>
                                                            <span>{words.detail}</span>
                                                        </span>
                                                        {isNew && <span className="duesNew">{t('New')}</span>}
                                                        <LuChevronRight className="taskChevron" aria-hidden="true" />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}
                            {GROUPS.map(({ tone, label }) => {
                                const group = items.filter((item) => item.tone === tone);
                                if (group.length === 0) return null;
                                return (
                                    <section key={tone} className="taskGroup">
                                        <h3>{t(label)}</h3>
                                        <ul>
                                            {group.map((item) => {
                                                const Icon = ICONS[item.kind];
                                                const words = duesText(item, i18n);
                                                return (
                                                    <li key={item.id} className="duesRow">
                                                        <button type="button" className={`taskItem ${tone === 'late' ? 'is-urgent' : ''}`} onClick={() => go(item)}>
                                                            <span className={`taskIcon ${KIND_CLASS[item.kind]}`} aria-hidden="true">
                                                                <Icon />
                                                            </span>
                                                            <span className="taskText">
                                                                <strong>{words.title}</strong>
                                                                <span>{words.detail}</span>
                                                            </span>
                                                            {!words.action.pay && <LuChevronRight className="taskChevron" aria-hidden="true" />}
                                                        </button>
                                                        {words.action.pay && (
                                                            <button type="button" className="duesPayBtn" onClick={() => pay(item)}>
                                                                <LuQrCode aria-hidden="true" /> {words.action.label}
                                                            </button>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {paying && (
                <DuePay
                    item={paying}
                    settings={data?.settings}
                    sandbox={data?.sandbox}
                    onClose={() => {
                        setPaying(null);
                        refresh(true);
                    }}
                />
            )}
        </>
    );
};

export default DuesBell;
