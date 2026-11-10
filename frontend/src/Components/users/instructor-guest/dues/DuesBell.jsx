import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react';
import { LuBell, LuChevronRight, LuPartyPopper, LuQrCode, LuReceipt, LuRepeat, LuTicket } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { duesText } from './duesText';
import { useMyDues } from './myDuesContext';
import DuePay from './DuePay';
import './dues.scss';

const ICONS = { tuition: LuReceipt, renewal: LuRepeat, deposit: LuTicket, room: LuTicket };
const KIND_CLASS = { tuition: 'kind-tuition', renewal: 'kind-renewals', deposit: 'kind-bookings', room: 'kind-bookings' };
const GROUPS = [
    { tone: 'late', label: 'Overdue' },
    { tone: 'soon', label: 'Due in the next few days' },
    { tone: 'due', label: 'Coming up' },
];

// /profile top bar: what the signed-in student or guest still has to pay or answer, each with a QR
// button that opens the payment right here (the same look as the staff to-do bell).
const DuesBell = () => {
    const i18n = useI18n();
    const { t, tn } = i18n;
    const navigate = useNavigate();
    const { data, refresh } = useMyDues();
    const [open, setOpen] = useState(false);
    const [paying, setPaying] = useState(null);
    const items = data?.items ?? [];
    const late = items.filter((item) => item.tone === 'late').length;

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
            <Popover placement="bottom-end" offset={12} isOpen={open} onOpenChange={setOpen} classNames={{ base: 'taskPopover' }}>
                <PopoverTrigger>
                    <button
                        type="button"
                        className={`iconButton taskBell${late ? ' hasUrgent' : ''}`}
                        aria-label={items.length ? t('Notifications: {count} to pay or answer', { count: items.length }) : t('Notifications: nothing to pay')}
                    >
                        <LuBell />
                        <AnimatePresence>
                            {items.length > 0 && (
                                <motion.span
                                    key={items.length}
                                    className="bellBadge"
                                    initial={{ scale: 0.4, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.4, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                >
                                    {items.length > 9 ? '9+' : items.length}
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
                            <span>
                                {items.length
                                    ? tn(items.length, '{count} thing to pay or answer', '{count} things to pay or answer')
                                    : t('Nothing to pay right now')}
                            </span>
                        </div>
                    </div>

                    {items.length === 0 ? (
                        <div className="taskEmpty">
                            <span className="taskEmptyIcon" aria-hidden="true">
                                <LuPartyPopper />
                            </span>
                            <strong>{t('All paid up. Thank you!')}</strong>
                            <span>{t('Tuition and room payments that need you will show up here.')}</span>
                        </div>
                    ) : (
                        <div className="taskScroll">
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
