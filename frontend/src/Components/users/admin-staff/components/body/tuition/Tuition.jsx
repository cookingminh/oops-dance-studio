import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import {
    assignTransfer,
    getTuitionSettings,
    ignoreTransfer,
    isPaymentSandbox,
    listInvoices,
    listTransfers,
    markPaid,
    openCourse,
    reopenInvoice,
    runCycle,
    setInvoiceAmount,
    setRenewal,
    simulateTransfer,
    undoPayment,
    waiveInvoice,
} from '@/services/tuition';
import { loadTuitionBoard } from '@/services/tuitionStaff';
import { listEnrolments } from '@/services/classSwitch';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { useStaffTasks } from '../../../tasks/staffTasks';
import { downloadCsv, monthOf, summarize, withCourses } from './tuitionModel';
import TuitionOverview from './TuitionOverview';
import RenewalTracker from './RenewalTracker';
import TransferInbox from './TransferInbox';
import InvoiceList from './InvoiceList';
import TuitionSettings from './TuitionSettings';
import PaymentDialog from './PaymentDialog';
import AdjustDialog from './AdjustDialog';
import PaymentCodeDialog from './PaymentCodeDialog';
import AssignDialog from './AssignDialog';
import SwitchClassDialog from '../../common/switch-class/SwitchClassDialog';
import './tuition.scss';

const SECTIONS = { overdue: 'tuition-invoices', transfers: 'tuition-transfers', renewal: 'tuition-renewal' };

// /admin/tuition (staff + admin): the page the desk uses every day to collect tuition, per course
// (khoá). The invoices on show — the courses running now (and finished ones still owed), the next
// courses (renewals) or the courses starting in a month — with their money; each class's renewal;
// the bank-transfer inbox; every invoice with its actions; and (admins) the bank account and rules.
const Tuition = () => {
    const { t } = useI18n();
    const toast = useToast();
    const { role } = useAuth();
    const { refresh: refreshTasks } = useStaffTasks();
    const location = useLocation();
    const [params] = useSearchParams();
    const show = params.get('show');

    const settings = useAsync(getTuitionSettings, []);
    const sandbox = useAsync(() => isPaymentSandbox().catch(() => false), []);
    const board = useAsync(loadTuitionBoard, []);
    const today = board.data?.today ?? null;
    const thisMonth = today ? monthOf(today) : null;

    const [view, setView] = useState('running'); // 'running' | 'next' | 'month'
    const [picked, setPicked] = useState(null); // 'yyyy-MM-01' of the month view; null = this month
    const month = picked ?? thisMonth;
    const monthly = useAsync(() => (view === 'month' && month ? listInvoices(month) : Promise.resolve(undefined)), [view, month]);
    const transfers = useAsync(() => listTransfers({ limit: 80 }), []);
    // Who is in which class now, from when and until when ("classId:studentId" → place).
    const enrolments = useAsync(() => listEnrolments().catch(() => new Map()), []);

    const [filter, setFilter] = useState(show === 'overdue' ? 'overdue' : 'all');
    const [query, setQuery] = useState(() => params.get('q') ?? ''); // ?q= from a person's panel
    const [busyId, setBusyId] = useState(null);
    const [dialog, setDialog] = useState(null); // { kind, invoice?, transfer? }

    // Every invoice with its course's progress (phase, sessions held, last session).
    const progressById = useMemo(() => new Map((board.data?.progress ?? []).map((row) => [row.lesson_id, row])), [board.data]);
    const boardRows = useMemo(() => (board.data ? withCourses(board.data.invoices, progressById, today) : []), [board.data, progressById, today]);
    const monthRows = useMemo(() => (monthly.data ? withCourses(monthly.data, progressById, today) : undefined), [monthly.data, progressById, today]);
    const sets = useMemo(
        () => ({
            running: boardRows.filter((invoice) => invoice.course.phase === 'current' || (invoice.course.phase === 'done' && invoice.status === 'unpaid')),
            next: boardRows.filter((invoice) => invoice.course.phase === 'planned'),
        }),
        [boardRows],
    );
    const rows = view === 'month' ? monthRows : board.data ? sets[view] : undefined;
    const listState = view === 'month' ? { ...monthly, data: monthRows } : { ...board, data: rows };
    const unpaid = useMemo(() => boardRows.filter((invoice) => invoice.status === 'unpaid'), [boardRows]);
    const summary = useMemo(() => summarize(rows ?? [], today), [rows, today]);

    // From a to-do (?show=overdue|transfers|renewal): pick the right view and scroll to it.
    // location.key changes on every visit, so clicking the same to-do twice still works.
    const ready = Boolean(today);
    useEffect(() => {
        if (!show || !ready) return undefined;
        if (show === 'overdue') {
            setView('running');
            setFilter('overdue');
        }
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = setTimeout(() => document.getElementById(SECTIONS[show])?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }), 450);
        return () => clearTimeout(timer);
    }, [show, ready, location.key]);

    const pickView = (value) => {
        setView(value);
        setFilter('all');
    };
    const pickMonth = (value) => {
        setPicked(value === thisMonth ? null : value);
        setFilter('all');
    };

    const refreshAll = () => {
        board.reload();
        if (view === 'month') monthly.reload();
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
        const running = invoice.course?.phase !== 'planned';
        // Stopping the running course takes them out of the class today: ask first.
        if (decision === 'stop' && running && !window.confirm(t('{name} stops {cls} now and leaves the class today. Continue?', vars))) return;
        run(invoice.id, () => setRenewal(invoice.id, decision),
            decision === 'continue'
                ? t('{name} continues with {course} in {cls}.', vars)
                : running
                    ? t('{name} stops {cls} now.', vars)
                    : t('{name} stops {cls} after the current course.', vars));
    };

    // Row menu and buttons.
    const onAction = (kind, invoice) => {
        switch (kind) {
            case 'pay':
            case 'code':
            case 'switch':
            case 'amount':
            case 'waive':
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

    // Bills every member of the class for its next course now, whatever the timing.
    const openRenewal = (course, cls) => {
        const vars = { title: course.title, cls: cls.name };
        if (!window.confirm(t('Open the renewal of “{title}” now? Every student in {cls} gets its invoice and can pay or answer straight away.', vars))) return;
        run(`open-${course.lesson_id}`, () => openCourse(course.lesson_id), (count) =>
            count
                ? (count === 1 ? t('Renewal open: {count} student billed for “{title}”.', { ...vars, count }) : t('Renewal open: {count} students billed for “{title}”.', { ...vars, count }))
                : t('Renewal open for “{title}”. Every member already has an invoice.', vars));
    };

    const assign = (transfer, invoice) =>
        run(`transfer-${transfer.id}`, () => assignTransfer(transfer.id, invoice.id), t('{amount} assigned to {name}.', { amount: formatVnd(transfer.amount), name: invoice.student_name }))
            .then((done) => done && setDialog(null));

    const runDailyCheck = () => {
        if (!window.confirm(t('Run today’s check now? It bills members who have no invoice for their running course, opens the next course’s renewal when it is time, cancels invoices that are unpaid and unanswered after their due date, and takes those students out of their class. It also runs by itself every night.'))) return;
        run('cycle', runCycle, (result) => t('Check done: {billed} billed, {cancelled} not renewed, {ended} left their class.', {
            billed: result?.billed ?? 0,
            cancelled: result?.not_renewed ?? 0,
            ended: result?.enrolments_ended ?? 0,
        }));
    };

    const exportName = view === 'month' ? (month ?? '').slice(0, 7) : `${view}-${today}`;
    const isAdmin = role === ROLES.admin;
    const close = () => setDialog(null);

    return (
        <>
            <TuitionOverview
                view={view}
                month={month}
                thisMonth={thisMonth}
                summary={summary}
                loading={listState.loading}
                onView={pickView}
                onPickMonth={pickMonth}
                onExport={() => downloadCsv(rows ?? [], exportName, today, t)}
            />

            <div className="tuDuo">
                <TransferInbox
                    state={transfers}
                    unpaid={unpaid}
                    invoices={boardRows}
                    busyId={busyId}
                    onAssign={assign}
                    onFind={(transfer) => setDialog({ kind: 'assign', transfer })}
                    onIgnore={(transfer, note) => run(`transfer-${transfer.id}`, () => ignoreTransfer(transfer.id, true, note.trim() || null), t('Transfer set aside.'))}
                    onRestore={(transfer) => run(`transfer-${transfer.id}`, () => ignoreTransfer(transfer.id, false), t('Transfer is back in the inbox.'))}
                />
                <RenewalTracker
                    state={board}
                    invoices={sets.next}
                    settings={settings.data}
                    today={today}
                    busyId={busyId}
                    onOpen={openRenewal}
                    onAnswer={answer}
                />
            </div>

            <InvoiceList
                view={view}
                month={month}
                today={today}
                state={listState}
                enrolments={enrolments.data}
                counts={summary.counts}
                filter={filter}
                onFilter={setFilter}
                query={query}
                onQuery={setQuery}
                busyId={busyId}
                onAction={onAction}
            />

            {isAdmin && settings.data && (
                <TuitionSettings settings={settings.data} sandbox={sandbox.data} onSaved={settings.reload} onRunCycle={runDailyCheck} running={busyId === 'cycle'} />
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
        </>
    );
};

export default Tuition;
