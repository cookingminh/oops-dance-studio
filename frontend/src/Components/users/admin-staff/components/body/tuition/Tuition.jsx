import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { LuLandmark, LuSettings2 } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import {
    assignTransfer,
    getTuitionSettings,
    ignoreTransfer,
    isPaymentSandbox,
    listTransfers,
    markPaid,
    reopenInvoice,
    runCycle,
    setInvoiceAmount,
    setInvoiceNote,
    setRenewal,
    simulateTransfer,
    undoPayment,
    waiveInvoice,
} from '@/services/tuition';
import { loadTuitionBoard } from '@/services/tuitionStaff';
import { listEnrolments } from '@/services/classSwitch';
import { assignTransferToBooking, unassignBookingTransfer } from '@/services/bookingPayments';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { useStaffTasks } from '../../../tasks/staffTasks';
import SwitchClassDialog from '../../common/switch-class/SwitchClassDialog';
import { classBoard, monthOf, moneyOf, peopleOn, runningInvoices, todoLists, withCourses } from './tuitionModel';
import TuitionStrip from './TuitionStrip';
import SearchResults from './SearchResults';
import TodoCard from './TodoCard';
import ClassBoard from './ClassBoard';
import SideDrawer from './SideDrawer';
import { TransferHistory } from './TransferInbox';
import TuitionSettings from './TuitionSettings';
import ExportDialog from './ExportDialog';
import PaymentDialog from './PaymentDialog';
import AdjustDialog from './AdjustDialog';
import PaymentCodeDialog from './PaymentCodeDialog';
import AssignDialog from './AssignDialog';
import NoteDialog from './NoteDialog';
import BookingAssignDialog from './BookingAssignDialog';
import './tuition.scss';

// Where the to-do bell's links land (?show=…); the to-do card when that group is empty.
const SECTIONS = { overdue: 'tuition-late', transfers: 'tuition-transfers', renewal: 'tuition-classes' };

// /admin/tuition (staff + admin): studio-wide money work only. A one-line summary of the running
// courses with the search and a ⋯ menu (export, the daily check, payment settings for admins); "To do"
// across every class (late, bank transfers to sort, due soon); and "By class", which sends each class
// to its own Tuition tab (its invoices course by course, every student's renewal answer).
const Tuition = () => {
    const { t } = useI18n();
    const toast = useToast();
    const { role } = useAuth();
    const isAdmin = role === ROLES.admin;
    const { refresh: refreshTasks } = useStaffTasks();
    const location = useLocation();
    const [params] = useSearchParams();
    const show = params.get('show');

    const settings = useAsync(getTuitionSettings, []);
    const sandbox = useAsync(() => isPaymentSandbox().catch(() => false), []);
    const board = useAsync(loadTuitionBoard, []);
    const transfers = useAsync(() => listTransfers({ limit: 80 }), []);
    // Who is in which class now, from when and until when ("classId:studentId" → place).
    const enrolments = useAsync(() => listEnrolments().catch(() => new Map()), []);
    const today = board.data?.today ?? null;
    const openAt = settings.data?.renewal_open_sessions ?? 2;

    const [query, setQuery] = useState(() => params.get('q') ?? ''); // ?q= from a person's panel
    const [busyId, setBusyId] = useState(null);
    const [dialog, setDialog] = useState(null); // { kind, invoice?, transfer? }
    const [drawer, setDrawer] = useState(null); // 'history' | 'settings'

    // Every invoice with its course's progress (phase, sessions held, last session).
    const progressById = useMemo(() => new Map((board.data?.progress ?? []).map((row) => [row.lesson_id, row])), [board.data]);
    const rows = useMemo(() => (board.data ? withCourses(board.data.invoices, progressById, today) : []), [board.data, progressById, today]);
    const running = useMemo(() => runningInvoices(rows), [rows]);
    const lists = useMemo(() => (today ? todoLists(rows, today) : { late: [], soon: [] }), [rows, today]);
    const unpaid = useMemo(() => rows.filter((invoice) => invoice.status === 'unpaid'), [rows]);
    const waiting = useMemo(() => (transfers.data ?? []).filter((transfer) => transfer.status === 'unmatched'), [transfers.data]);
    const classes = useMemo(
        () => (board.data ? classBoard(board.data.classes, board.data.progress, rows, today, openAt, { openFirst: show === 'renewal' }) : []),
        [board.data, rows, today, openAt, show],
    );
    const searching = query.trim().length > 0;

    // From a to-do (?show=overdue|transfers|renewal): scroll to that group. location.key changes on
    // every visit, so clicking the same to-do twice still works.
    const ready = Boolean(today);
    useEffect(() => {
        if (!show || !ready) return undefined;
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = setTimeout(() => {
            const target = document.getElementById(SECTIONS[show]) ?? document.getElementById('tuition-todo');
            target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        }, 450);
        return () => clearTimeout(timer);
    }, [show, ready, location.key]);

    const refreshAll = () => {
        board.reload();
        transfers.reload();
        enrolments.reload();
        refreshTasks();
    };

    // Runs one write; true when it worked (dialogs close then).
    const run = async (id, action, message) => {
        setBusyId(id);
        try {
            const result = await action();
            const text = typeof message === 'function' ? message(result) : message;
            if (text) toast.success(text);
            refreshAll();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const courseOf = (invoice) => invoice.lesson_title || invoice.class_name;

    const answer = (invoice, decision) => {
        const vars = { name: invoice.student_name, cls: invoice.class_name, course: courseOf(invoice) };
        const runningNow = invoice.course?.phase !== 'planned';
        // Stopping the running course takes them out of the class today: ask first.
        if (decision === 'stop' && runningNow && !window.confirm(t('{name} stops {cls} now and leaves the class today. Continue?', vars))) return;
        run(invoice.id, () => setRenewal(invoice.id, decision),
            decision === 'continue'
                ? t('{name} continues with {course} in {cls}.', vars)
                : runningNow
                    ? t('{name} stops {cls} now.', vars)
                    : t('{name} stops {cls} after the current course.', vars));
    };

    // Row buttons and menu.
    const onAction = (kind, invoice) => {
        switch (kind) {
            case 'pay':
            case 'code':
            case 'switch':
            case 'amount':
            case 'waive':
            case 'note':
                setDialog({ kind, invoice });
                break;
            case 'undo':
                if (!window.confirm(t('Undo the {amount} payment from {name}? Transfers that paid it go back to the inbox.', { amount: formatVnd(invoice.paid_amount), name: invoice.student_name }))) return;
                run(invoice.id, () => undoPayment(invoice.id), t('Payment undone.'));
                break;
            case 'reopen':
                run(invoice.id, () => reopenInvoice(invoice.id), t('Invoice reopened.'));
                break;
            case 'continue':
            case 'stop':
                answer(invoice, kind);
                break;
            default:
        }
    };

    const assign = (transfer, invoice) =>
        run(`transfer-${transfer.id}`, () => assignTransfer(transfer.id, invoice.id), t('{amount} assigned to {name}.', { amount: formatVnd(transfer.amount), name: invoice.student_name }))
            .then((done) => done && setDialog(null));

    // A room booking's transfer: put an inbox transfer on it, or take one back off it.
    const assignBooking = (transfer, booking) =>
        run(`transfer-${transfer.id}`, () => assignTransferToBooking(transfer.id, booking.id), t('{amount} assigned to booking #{id}.', { amount: formatVnd(transfer.amount), id: booking.id }))
            .then((done) => done && setDialog(null));

    const takeBack = (transfer) => {
        if (!window.confirm(t('Take {amount} back off booking #{id}? The transfer goes back to the inbox.', { amount: formatVnd(transfer.amount), id: transfer.booking.id }))) return;
        run(`transfer-${transfer.id}`, () => unassignBookingTransfer(transfer.id), t('Transfer taken back. It is in the inbox again.'));
    };

    const runDailyCheck = () => {
        if (!window.confirm(t('Run today’s check now? It bills members who have no invoice for their running course, opens the next course’s renewal when it is time, cancels invoices that are unpaid and unanswered after their due date, and takes those students out of their class. It also runs by itself every night.'))) return;
        run('cycle', runCycle, (result) => t('Check done: {billed} billed, {cancelled} not renewed, {ended} left their class.', {
            billed: result?.billed ?? 0,
            cancelled: result?.not_renewed ?? 0,
            ended: result?.enrolments_ended ?? 0,
        }));
    };

    const onMenu = (key) => {
        if (key === 'export') setDialog({ kind: 'export' });
        else if (key === 'check') runDailyCheck();
        else if (key === 'settings') setDrawer('settings');
    };

    const close = () => setDialog(null);
    const rowProps = { today, enrolments: enrolments.data, busyId, onAction };

    return (
        <>
            <TuitionStrip
                money={moneyOf(running)}
                latePeople={peopleOn(lists.late)}
                loading={board.loading && !board.data}
                query={query}
                onQuery={setQuery}
                isAdmin={isAdmin}
                busy={busyId === 'cycle'}
                onMenu={onMenu}
            />

            {searching && board.data && (
                <SearchResults query={query} invoices={rows} progressById={progressById} onClear={() => setQuery('')} {...rowProps} />
            )}

            <TodoCard
                state={board}
                lists={lists}
                invoices={rows}
                transfers={waiting}
                onHistory={() => setDrawer('history')}
                transferProps={{
                    unpaid,
                    busyId,
                    onAssign: assign,
                    onFind: (transfer) => setDialog({ kind: 'assign', transfer }),
                    onFindBooking: (transfer) => setDialog({ kind: 'assignBooking', transfer }),
                    onIgnore: (transfer, note) => run(`transfer-${transfer.id}`, () => ignoreTransfer(transfer.id, true, note.trim() || null), t('Transfer set aside.')),
                }}
                {...rowProps}
            />

            <ClassBoard state={board} entries={classes} openAt={openAt} asking={show === 'renewal'} />

            {drawer === 'history' && (
                <SideDrawer id="tuition-history" icon={LuLandmark} title={t('Transfer history')} subtitle={t('Bank transfers already matched or set aside.')} onClose={() => setDrawer(null)}>
                    <TransferHistory
                        state={transfers}
                        invoices={rows}
                        busyId={busyId}
                        onTakeBack={takeBack}
                        onRestore={(transfer) => run(`transfer-${transfer.id}`, () => ignoreTransfer(transfer.id, false), t('Transfer is back in the inbox.'))}
                    />
                </SideDrawer>
            )}
            {drawer === 'settings' && isAdmin && settings.data && (
                <SideDrawer id="tuition-settings" icon={LuSettings2} title={t('Payment settings')} subtitle={t('The bank account, the renewal rules and automatic payments.')} wide onClose={() => setDrawer(null)}>
                    <TuitionSettings settings={settings.data} sandbox={sandbox.data} onSaved={settings.reload} />
                </SideDrawer>
            )}

            {dialog?.kind === 'export' && today && (
                <ExportDialog
                    sets={{ running, next: rows.filter((invoice) => invoice.course.phase === 'planned') }}
                    thisMonth={monthOf(today)}
                    today={today}
                    progressById={progressById}
                    onClose={close}
                />
            )}
            {dialog?.kind === 'pay' && (
                <PaymentDialog
                    invoice={dialog.invoice}
                    onClose={close}
                    onSubmit={(payment) => run(dialog.invoice.id, () => markPaid(dialog.invoice.id, payment), t('Payment recorded for {name}.', { name: dialog.invoice.student_name }))}
                />
            )}
            {(dialog?.kind === 'waive' || dialog?.kind === 'amount') && (
                <AdjustDialog
                    invoice={dialog.invoice}
                    mode={dialog.kind}
                    onClose={close}
                    onSubmit={({ amount, note }) =>
                        dialog.kind === 'waive'
                            ? run(dialog.invoice.id, () => waiveInvoice(dialog.invoice.id, note), t('{course} waived for {name}.', { course: courseOf(dialog.invoice), name: dialog.invoice.student_name }))
                            : run(dialog.invoice.id, () => setInvoiceAmount(dialog.invoice.id, amount, note), t('Amount changed to {amount}.', { amount: formatVnd(amount) }))
                    }
                />
            )}
            {dialog?.kind === 'note' && (
                <NoteDialog
                    invoice={dialog.invoice}
                    onClose={close}
                    onSubmit={(note) => run(dialog.invoice.id, () => setInvoiceNote(dialog.invoice.id, note), note ? t('Note saved.') : t('Note removed.'))}
                />
            )}
            {dialog?.kind === 'code' && (
                <PaymentCodeDialog
                    invoice={dialog.invoice}
                    settings={settings.data}
                    sandbox={Boolean(sandbox.data)}
                    onClose={close}
                    onSimulate={() => run(dialog.invoice.id, () => simulateTransfer(dialog.invoice.id), t('Transfer received: {name} has paid.', { name: dialog.invoice.student_name }))}
                />
            )}
            {dialog?.kind === 'switch' && (
                <SwitchClassDialog
                    student={{
                        id: dialog.invoice.student_id,
                        name: dialog.invoice.student_name,
                        avatar_path: dialog.invoice.student?.avatar_path,
                        updated_at: dialog.invoice.student?.updated_at,
                    }}
                    fromClass={{ id: dialog.invoice.class_id, name: dialog.invoice.class_name }}
                    onClose={close}
                    onSwitched={() => {
                        close();
                        refreshAll();
                    }}
                />
            )}
            {dialog?.kind === 'assign' && (
                <AssignDialog transfer={dialog.transfer} unpaid={unpaid} busy={busyId === `transfer-${dialog.transfer.id}`} onClose={close} onAssign={assign} />
            )}
            {dialog?.kind === 'assignBooking' && (
                <BookingAssignDialog
                    transfer={dialog.transfer}
                    busy={busyId === `transfer-${dialog.transfer.id}`}
                    onClose={close}
                    onAssign={(booking) => assignBooking(dialog.transfer, booking)}
                />
            )}
        </>
    );
};

export default Tuition;
