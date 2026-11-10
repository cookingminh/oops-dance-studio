import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from '@nextui-org/react';
import {
    LuArrowRightLeft,
    LuBadgePercent,
    LuBanknote,
    LuCheck,
    LuGift,
    LuMoreVertical,
    LuQrCode,
    LuRotateCcw,
    LuStickyNote,
    LuUndo2,
    LuX,
} from 'react-icons/lu';
import { amountDue } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../common/motion';
import { classPath } from '../class-hub/hubModel';
import { keptForDanced, movedToName, switchedFrom } from '../../common/switch-class/switchNotes';
import { LATE_NOTE, METHOD_LABELS, VOID_REASONS, coursePrice, daysBetween, invoiceActions, joinedLate, rowState } from './tuitionModel';
import { PlaceTag, RenewalChip, StatePill, StudentCell } from './TuitionParts';

const ACTION_INFO = {
    pay: { label: 'Record payment', icon: LuBanknote },
    code: { label: 'Show payment code', icon: LuQrCode },
    undo: { label: 'Undo payment', icon: LuUndo2, danger: true },
    amount: { label: 'Change amount', icon: LuBadgePercent },
    waive: { label: 'Waive this course', icon: LuGift },
    reopen: { label: 'Reopen', icon: LuRotateCcw },
    continue: { label: 'Mark as continuing', icon: LuCheck },
    stop: { label: 'Mark as stopping', icon: LuX, danger: true },
    switch: { label: 'Switch class', icon: LuArrowRightLeft },
    note: { label: 'Add note', icon: LuStickyNote },
};
const MENU_GROUPS = { money: 'Invoice actions', fix: 'Invoice actions', renewal: 'Renewal', move: 'Class' };

// When it's due / when it was paid / why it was cancelled / where the student moved to.
const WhenCell = ({ invoice, state, today, invoices }) => {
    const { t, tn, formatDate } = useI18n();
    if (state === 'switched') {
        const to = movedToName(invoice, invoices);
        const kept = keptForDanced(invoice);
        return (
            <span className="tuWhen isSwitched">
                <strong title={to}>{to ? t('Switched → {className}', { className: to }) : t('Switched class')}</strong>
                <small>
                    {kept
                        ? tn(kept.held, '{amount} kept for {count} session danced', '{amount} kept for {count} sessions danced', { amount: formatVnd(kept.kept) })
                        : t('Not counted as leaving')}
                </small>
            </span>
        );
    }
    if (invoice.status === 'paid') {
        return (
            <span className="tuWhen">
                <strong>{t('Paid {date}', { date: invoice.paid_at ? formatDate(invoice.paid_at.slice(0, 10), 'dayMonth') : '' })}</strong>
                <small>{invoice.method ? t(METHOD_LABELS[invoice.method]) : ''}</small>
            </span>
        );
    }
    if (invoice.status === 'void') {
        return (
            <span className="tuWhen">
                <strong>{t(VOID_REASONS[invoice.void_reason] ?? 'Cancelled')}</strong>
            </span>
        );
    }
    if (invoice.status === 'waived') {
        return (
            <span className="tuWhen">
                <strong>{t('No payment needed')}</strong>
            </span>
        );
    }
    const late = state === 'overdue' ? daysBetween(invoice.due_date, today) : 0;
    return (
        <span className={`tuWhen${late ? ' isLate' : ''}`}>
            <strong>{t('Due {date}', { date: formatDate(invoice.due_date, 'dayMonth') })}</strong>
            {late > 0 && <small>{tn(late, '{count} day late', '{count} days late')}</small>}
        </span>
    );
};

// One invoice: who, how much, where it stands, their renewal answer, the date that matters and
// what can be done with it (the main action on the row, the rest in the ⋮ menu). `invoices` is
// every invoice on show (to name the other class of a class switch); `place` is the student's place
// in this class now ({ joined_at, leaves_after }, null when they've left it). Older callers may pass
// `enrolled` (boolean) and `thisMonth` instead (rows without course phases).
// Lists across classes (the tuition page) pass `showClass`: the class · course goes on the row (a
// link to that class's Tuition tab) and the status chips share one cell. `quick` puts the payment
// code and the note next to "Record payment" instead of in the menu.
const InvoiceRow = ({ invoice, invoices, today, place, enrolled, thisMonth, busy, onAction, showClass = false, quick = false }) => {
    const { t } = useI18n();
    const state = rowState(invoice, today);
    const where = place !== undefined ? place : enrolled ? {} : null;
    const actions = invoiceActions(invoice, where, thisMonth);
    const direct = quick ? ['code', 'note'].filter((key) => actions.money.includes(key) || actions.fix.includes(key)) : [];
    const menu = [
        ['money', actions.money.filter((key) => key !== 'pay' && !direct.includes(key))],
        ['fix', actions.fix.filter((key) => !direct.includes(key))],
        ['renewal', actions.renewal],
        ['move', actions.move],
    ].filter(([, keys]) => keys.length);
    const from = switchedFrom(invoice, invoices);
    // A switch's own notes are shown as the tag and the When cell; the rest is staff's words.
    const rawNote = state === 'switched' ? '' : from ? from.note : invoice.note ?? '';
    const late = rawNote.match(LATE_NOTE);
    const note = late ? rawNote.slice(late[0].length) : rawNote;
    const paid = Number(invoice.paid_amount);
    const isLate = joinedLate(invoice);
    const listPrice = coursePrice(invoice);
    const discounted = !isLate && listPrice !== null && Number(listPrice) !== Number(invoice.amount);
    const name = invoice.student_name;
    const renewal = invoice.status !== 'void' && invoice.status !== 'waived' ? <RenewalChip renewal={invoice.renewal} /> : null;
    const who = { name, cls: invoice.class_name };

    return (
        <motion.li variants={fadeUp} className={`tuRow is-${state}${showClass ? ' hasClass' : ''}${quick ? ' isQuick' : ''}`} data-code={invoice.payment_code}>
            <StudentCell invoice={invoice} />
            {showClass && (
                <span className="tuCourseCell">
                    {invoice.class_id ? (
                        <Link to={classPath(invoice.class_id, { tab: 'tuition', course: invoice.lesson_id ?? undefined })} className="tuClassLink">
                            {invoice.class_name}
                        </Link>
                    ) : (
                        <strong>{invoice.class_name}</strong>
                    )}
                    <small title={invoice.lesson_title}>{invoice.lesson_title}</small>
                </span>
            )}
            <span className="tuAmount">
                <strong>{formatVnd(invoice.amount)}</strong>
                {invoice.status === 'unpaid' && paid > 0 ? (
                    <small>{t('{paid} paid · {due} left', { paid: formatVnd(paid), due: formatVnd(amountDue(invoice)) })}</small>
                ) : isLate ? (
                    <small className="tuWas">{t('{left} of {count} sessions · joined late', { left: invoice.sessions, count: invoice.course.session_count })}</small>
                ) : discounted ? (
                    <small className="tuWas">{t('List price {amount}', { amount: formatVnd(listPrice) })}</small>
                ) : null}
                {from && (
                    <span className="tuFromTag" title={t('Switched from {className}', { className: from.className })}>
                        <LuArrowRightLeft aria-hidden="true" />
                        <span>{t('from {className}', { className: from.className })}</span>
                    </span>
                )}
                <PlaceTag place={where} today={today} />
            </span>
            {showClass ? (
                <span className="tuChipsCell">
                    <StatePill state={state} />
                    {renewal}
                </span>
            ) : (
                <>
                    <span className="tuStateCell">
                        <StatePill state={state} />
                    </span>
                    <span className="tuRenewalCell">{renewal}</span>
                </>
            )}
            <WhenCell invoice={invoice} state={state} today={today} invoices={invoices} />
            <span className="tuRowActions">
                {actions.money.includes('pay') ? (
                    <Button
                        size="sm"
                        variant="flat"
                        className="tuPayButton"
                        startContent={<LuBanknote aria-hidden="true" />}
                        isDisabled={busy}
                        aria-label={t('Record payment for {name}, {cls}', who)}
                        onPress={() => onAction('pay', invoice)}
                    >
                        {t('Record payment')}
                    </Button>
                ) : (
                    <span className="tuPaySlot" aria-hidden="true" />
                )}
                {direct.map((key) => {
                    const Icon = ACTION_INFO[key].icon;
                    const label = key === 'note' ? (note ? t('Edit note for {name}, {cls}', who) : t('Add note for {name}, {cls}', who)) : t('Payment code for {name}, {cls}', who);
                    return (
                        <Button key={key} isIconOnly size="sm" variant="light" className={`tuQuickButton is-${key}${key === 'note' && note ? ' hasNote' : ''}`} isDisabled={busy} aria-label={label} title={label} onPress={() => onAction(key, invoice)}>
                            <Icon aria-hidden="true" />
                        </Button>
                    );
                })}
                <Dropdown placement="bottom-end" classNames={{ content: 'adminPortal' }}>
                    <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" isLoading={busy} isDisabled={!menu.length} aria-label={t('More for {name}, {cls}', who)}>
                            <LuMoreVertical />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label={t('Invoice actions')} onAction={(key) => onAction(String(key), invoice)}>
                        {menu.map(([group, keys], index) => (
                            <DropdownSection key={group} showDivider={index < menu.length - 1} aria-label={t(MENU_GROUPS[group])}>
                                {keys.map((key) => {
                                    const { label: baseLabel, icon: Icon, danger } = ACTION_INFO[key];
                                    const label = key === 'note' && note ? 'Edit note' : baseLabel;
                                    return (
                                        <DropdownItem key={key} startContent={<Icon aria-hidden="true" />} className={danger ? 'text-danger' : undefined} color={danger ? 'danger' : 'default'}>
                                            {t(label)}
                                        </DropdownItem>
                                    );
                                })}
                            </DropdownSection>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </span>
            {(note || from?.extra > 0) && (
                <p className="tuRowNote">
                    <LuStickyNote aria-hidden="true" />
                    <span>
                        {from?.extra > 0 && t('Paid {amount} more than this course costs.', { amount: formatVnd(from.extra) })}
                        {from?.extra > 0 && note && ' '}
                        {note}
                    </span>
                </p>
            )}
        </motion.li>
    );
};

export default InvoiceRow;
