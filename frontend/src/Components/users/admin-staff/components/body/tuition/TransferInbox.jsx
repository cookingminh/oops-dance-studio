import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input } from '@nextui-org/react';
import { LuArrowDownLeft, LuEyeOff, LuInbox, LuLandmark, LuPartyPopper, LuSearch, LuUndo2 } from 'react-icons/lu';
import { amountDue } from '@/services/tuition';
import { formatClock, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { fadeUp, stagger } from '../../common/motion';
import { PROVIDERS, REASON_LABELS, suggestInvoices, transferNote } from './tuitionModel';
import { StudentCell } from './TuitionParts';

const IGNORE_REASONS = ['Room deposit', 'Refund', 'Not for the studio', 'Paid twice'];
const HISTORY = 8;
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
const UnmatchedTransfer = ({ transfer, unpaid, busyId, onAssign, onFind, onIgnore }) => {
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
                                {t('Ignore transfer')}
                            </Button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="actions" className="tuTransferActions" {...reveal}>
                        <Button size="sm" variant="flat" startContent={<LuSearch aria-hidden="true" />} isDisabled={busy} onPress={() => onFind(transfer)}>
                            {t('Find invoice')}
                        </Button>
                        <Button size="sm" variant="light" startContent={<LuEyeOff aria-hidden="true" />} isDisabled={busy} onPress={() => setIgnoring(true)}>
                            {t('Ignore')}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
};

// The bank-transfer inbox: transfers without a usable invoice code wait here for staff to assign
// to an invoice or set aside; matched and ignored ones stay as a short history. `invoices` (the
// page's) name the course a matched transfer paid.
const TransferInbox = ({ state, unpaid, invoices = [], busyId, onAssign, onFind, onIgnore, onRestore }) => {
    const { t, tn } = useI18n();
    const courseOf = (invoiceId) => invoices.find((invoice) => invoice.id === invoiceId)?.lesson_title;
    const [tab, setTab] = useState('unmatched');
    const [showAll, setShowAll] = useState(false);
    const transfers = state.data ?? [];
    const lists = {
        unmatched: transfers.filter((row) => row.status === 'unmatched'),
        matched: transfers.filter((row) => row.status === 'matched'),
        ignored: transfers.filter((row) => row.status === 'ignored'),
    };
    const waiting = lists.unmatched.length;
    const history = showAll ? lists[tab] : lists[tab].slice(0, HISTORY);
    const tabs = [
        { key: 'unmatched', label: t('To sort'), count: waiting },
        { key: 'matched', label: t('Matched'), count: lists.matched.length },
        { key: 'ignored', label: t('Ignored'), count: lists.ignored.length },
    ];
    const pickTab = (key) => {
        setTab(key);
        setShowAll(false);
    };

    return (
        <SectionCard
            id="tuition-transfers"
            className="tuInboxCard"
            icon={LuLandmark}
            title={t('Bank transfers')}
            subtitle={waiting ? tn(waiting, '{count} transfer has no invoice code yet.', '{count} transfers have no invoice code yet.') : t('Transfers with an invoice code mark it paid by themselves.')}
        >
            <Segmented label={t('Bank transfers')} options={tabs} value={tab} onChange={pickTab} className="tuTabs" />
            <AsyncState state={state} isEmpty={false}>
                {tab === 'unmatched' &&
                    (waiting === 0 ? (
                        <div className="tuInboxEmpty">
                            <span aria-hidden="true">
                                <LuPartyPopper />
                            </span>
                            <strong>{t('Nothing to sort')}</strong>
                            <small>{t('Transfers without a code show up here, with the invoices they probably pay.')}</small>
                        </div>
                    ) : (
                        <motion.ul className="tuTransfers" variants={stagger} initial="hidden" animate="show">
                            <AnimatePresence initial={false}>
                                {lists.unmatched.map((transfer) => (
                                    <UnmatchedTransfer key={transfer.id} transfer={transfer} unpaid={unpaid} busyId={busyId} onAssign={onAssign} onFind={onFind} onIgnore={onIgnore} />
                                ))}
                            </AnimatePresence>
                        </motion.ul>
                    ))}

                {tab !== 'unmatched' &&
                    (lists[tab].length === 0 ? (
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
                                            </strong>
                                            <small>
                                                {transfer.invoice ? `${[transfer.invoice.class_name, courseOf(transfer.invoice.id)].filter(Boolean).join(' · ')} · ` : ''}
                                                <span className="tuMono">{transfer.content}</span>
                                            </small>
                                            <TransferMeta transfer={transfer} />
                                        </span>
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
                    ))}
            </AsyncState>
        </SectionCard>
    );
};

export default TransferInbox;
