import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input } from '@nextui-org/react';
import { LuArrowDownLeft, LuEyeOff, LuInbox, LuSearch, LuTicket, LuUndo2 } from 'react-icons/lu';
import { amountDue } from '@/services/tuition';
import { formatClock, formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import Segmented from '../../common/Segmented';
import { fadeUp, stagger } from '../../common/motion';
import { PROVIDERS, REASON_LABELS, suggestInvoices, transferNote } from './tuitionModel';
import { StudentCell } from './TuitionParts';

const IGNORE_REASONS = ['Room deposit', 'Refund', 'Not for the studio', 'Paid twice'];
const HISTORY = 12;
const reveal = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.22 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.15 } },
};

// When, from where, and the note the bank sync left.
const TransferMeta = ({ transfer }) => {
    const { t, formatDate } = useI18n();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(transfer.received_at));
    return (
        <span className="tuTransferMeta">
            {formatDate(day, 'short')} · {formatClock(transfer.received_at)} · {PROVIDERS[transfer.provider] ?? transfer.provider}
            {transfer.note && <em> · {transferNote(transfer.note, t, formatVnd)}</em>}
        </span>
    );
};

// A transfer waiting in the inbox: what came in, the invoices it probably pays, and assign / ignore.
const UnmatchedTransfer = ({ transfer, unpaid, busyId, onAssign, onFind, onFindBooking, onIgnore }) => {
    const { t } = useI18n();
    const [ignoring, setIgnoring] = useState(false);
    const [note, setNote] = useState('');
    const suggestions = suggestInvoices(transfer, unpaid);
    const busy = busyId === `transfer-${transfer.id}`;

    return (
        <motion.li variants={fadeUp} layout exit={{ opacity: 0, x: 24 }} className="tuTransfer" data-transfer={transfer.id}>
            <div className="tuTransferTop">
                <span className="tuTransferIcon" aria-hidden="true">
                    <LuArrowDownLeft />
                </span>
                <span className="tuTransferMain">
                    <strong className="tuTransferAmount">+{formatVnd(transfer.amount)}</strong>
                    <TransferMeta transfer={transfer} />
                </span>
            </div>
            <p className="tuTransferContent">
                <span className="sr-only">{t('Transfer content')}: </span>
                {transfer.content || t('(no content)')}
            </p>

            {suggestions.length > 0 ? (
                <div className="tuSuggest">
                    <h4>{t('Probably paying')}</h4>
                    <ul>
                        {suggestions.map(({ invoice, reasons }) => (
                            <li key={invoice.id}>
                                <StudentCell invoice={invoice} detail={<small>{[invoice.class_name, invoice.lesson_title, formatVnd(amountDue(invoice))].filter(Boolean).join(' · ')}</small>} />
                                <span className="tuReasons">
                                    {reasons.map((reason) => (
                                        <span key={reason} className={`tuReason is-${reason}`}>
                                            {t(REASON_LABELS[reason])}
                                        </span>
                                    ))}
                                </span>
                                <Button
                                    size="sm"
                                    color="danger"
                                    variant="flat"
                                    isDisabled={busy}
                                    aria-label={t('Assign to {name}, {cls}', { name: invoice.student_name, cls: invoice.class_name })}
                                    onPress={() => onAssign(transfer, invoice)}
                                >
                                    {t('Assign')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="tuFinePrint">{t('No invoice looks like a match. Find it by name, class or code.')}</p>
            )}

            <AnimatePresence initial={false} mode="wait">
                {ignoring ? (
                    <motion.div key="ignore" className="tuIgnoreBox" {...reveal}>
                        <Input size="sm" label={t('Why set it aside?')} value={note} onValueChange={setNote} maxLength={300} autoFocus />
                        <div className="tuQuick">
                            {IGNORE_REASONS.map((reason) => (
                                <button key={reason} type="button" onClick={() => setNote(t(reason))}>
                                    {t(reason)}
                                </button>
                            ))}
                        </div>
                        <div className="tuTransferActions">
                            <Button size="sm" variant="light" onPress={() => setIgnoring(false)}>
                                {t('Cancel')}
                            </Button>
                            <Button size="sm" color="danger" isLoading={busy} onPress={() => onIgnore(transfer, note)}>
                                {t('Set it aside')}
                            </Button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="actions" className="tuTransferActions" {...reveal}>
                        <Button size="sm" variant="flat" startContent={<LuSearch aria-hidden="true" />} isDisabled={busy} onPress={() => onFind(transfer)}>
                            {t('Assign to an invoice')}
                        </Button>
                        {onFindBooking && (
                            <Button size="sm" variant="flat" startContent={<LuTicket aria-hidden="true" />} isDisabled={busy} onPress={() => onFindBooking(transfer)}>
                                {t('Assign to a booking')}
                            </Button>
                        )}
                        <Button size="sm" variant="light" startContent={<LuEyeOff aria-hidden="true" />} isDisabled={busy} onPress={() => setIgnoring(true)}>
                            {t('Set aside')}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
};

// The transfers waiting in the inbox (no usable invoice code), each with the invoices it probably
// pays and assign (an invoice or a room booking) / set aside.
export const UnmatchedTransfers = ({ transfers, unpaid, busyId, onAssign, onFind, onFindBooking, onIgnore }) => (
    <motion.ul className="tuTransfers" variants={stagger} initial="hidden" animate="show">
        <AnimatePresence initial={false}>
            {transfers.map((transfer) => (
                <UnmatchedTransfer
                    key={transfer.id}
                    transfer={transfer}
                    unpaid={unpaid}
                    busyId={busyId}
                    onAssign={onAssign}
                    onFind={onFind}
                    onFindBooking={onFindBooking}
                    onIgnore={onIgnore}
                />
            ))}
        </AnimatePresence>
    </motion.ul>
);

// The transfers already sorted: matched (to an invoice or a room booking — a booking's can be taken
// back off it) and set aside (back to the inbox). `invoices` (the page's) name the course a matched
// transfer paid.
export const TransferHistory = ({ state, invoices = [], busyId, onRestore, onTakeBack }) => {
    const { t, formatDate } = useI18n();
    const courseOf = (invoiceId) => invoices.find((invoice) => invoice.id === invoiceId)?.lesson_title;
    const [tab, setTab] = useState('matched');
    const [showAll, setShowAll] = useState(false);
    const transfers = state.data ?? [];
    const lists = {
        matched: transfers.filter((row) => row.status === 'matched'),
        ignored: transfers.filter((row) => row.status === 'ignored'),
    };
    const history = showAll ? lists[tab] : lists[tab].slice(0, HISTORY);
    const tabs = [
        { key: 'matched', label: t('Matched'), count: lists.matched.length },
        { key: 'ignored', label: t('Ignored'), count: lists.ignored.length },
    ];
    const pickTab = (key) => {
        setTab(key);
        setShowAll(false);
    };

    return (
        <>
            <Segmented label={t('Bank transfers')} options={tabs} value={tab} onChange={pickTab} className="tuTabs" />
            <AsyncState state={state} isEmpty={false}>
                {lists[tab].length === 0 ? (
                    <div className="tuInboxEmpty">
                        <span aria-hidden="true">
                            <LuInbox />
                        </span>
                        <strong>{tab === 'matched' ? t('No matched transfers yet') : t('Nothing set aside')}</strong>
                    </div>
                ) : (
                    <>
                        <motion.ul key={tab} className="tuHistory" variants={stagger} initial="hidden" animate="show">
                            {history.map((transfer) => (
                                <motion.li key={transfer.id} variants={fadeUp} data-transfer={transfer.id}>
                                    <span className="tuHistoryText">
                                        <strong>
                                            +{formatVnd(transfer.amount)}
                                            {transfer.invoice && <span> · {transfer.invoice.student_name}</span>}
                                            {transfer.booking && (
                                                <span>
                                                    {' · '}
                                                    {t('Booking #{id}', { id: transfer.booking.id })} · {transfer.booking.guest?.full_name || transfer.booking.guest?.username}
                                                </span>
                                            )}
                                        </strong>
                                        <small>
                                            {transfer.invoice ? `${[transfer.invoice.class_name, courseOf(transfer.invoice.id)].filter(Boolean).join(' · ')} · ` : ''}
                                            {transfer.booking
                                                ? `${[transfer.booking.room?.name, `${formatDate(transfer.booking.date, 'short')} ${formatTimeRange(transfer.booking.start_time, transfer.booking.end_time)}`].filter(Boolean).join(' · ')} · `
                                                : ''}
                                            <span className="tuMono">{transfer.content}</span>
                                        </small>
                                        <TransferMeta transfer={transfer} />
                                    </span>
                                    {tab === 'matched' && transfer.booking && onTakeBack && (
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            startContent={<LuUndo2 aria-hidden="true" />}
                                            isLoading={busyId === `transfer-${transfer.id}`}
                                            aria-label={t('Take back: {content}', { content: transfer.content })}
                                            onPress={() => onTakeBack(transfer)}
                                        >
                                            {t('Take back')}
                                        </Button>
                                    )}
                                    {tab === 'ignored' && (
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            startContent={<LuUndo2 aria-hidden="true" />}
                                            isLoading={busyId === `transfer-${transfer.id}`}
                                            aria-label={t('Back to inbox: {content}', { content: transfer.content })}
                                            onPress={() => onRestore(transfer)}
                                        >
                                            {t('Back to inbox')}
                                        </Button>
                                    )}
                                </motion.li>
                            ))}
                        </motion.ul>
                        {lists[tab].length > HISTORY && (
                            <button type="button" className="tuLinkButton tuMore" onClick={() => setShowAll((value) => !value)}>
                                {showAll ? t('Show less') : t('Show all {count}', { count: lists[tab].length })}
                            </button>
                        )}
                    </>
                )}
            </AsyncState>
        </>
    );
};
