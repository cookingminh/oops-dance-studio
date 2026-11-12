import { useMemo, useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import {
    attachReceipt,
    createExpense,
    deleteRecurring,
    listExpenses,
    listRecurring,
    removeReceipt,
    runRecurring,
    saveRecurring,
    updateExpense,
} from '@/services/expenses';
import { deleteExpenseAndReceipt, listClassOptions, signReceiptUrls } from '@/services/expensesExtra';
import { getStudioToday } from '@/services/studio';
import { formatVnd } from '@/lib/format';
import { expenseTitle, isAutomaticRent } from '@/lib/expenseCategories';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import ExpenseOverview from './ExpenseOverview';
import ExpenseList from './ExpenseList';
import RecurringCard from './RecurringCard';
import ExpenseDialog from './ExpenseDialog';
import RecurringDialog from './RecurringDialog';
import ReceiptViewer from './ReceiptViewer';
import { monthOf, nextMonth, prevMonth, sameDayLastMonth, summarize } from './expensesModel';
import './expenses.scss';

const NO_FILTERS = { category: 'all', classKey: 'all', query: '' };
const nothing = () => Promise.resolve(undefined);

// /admin/expenses — the studio's "money out" book. Admins see and manage every cost and the
// recurring ones; staff record their own petty costs and only ever see those (RLS).
const Expenses = () => {
    const { t, monthName } = useI18n();
    const toast = useToast();
    const { role, user } = useAuth();
    const isAdmin = role === ROLES.admin;

    const today = useAsync(getStudioToday, []);
    const thisMonth = today.data ? monthOf(today.data) : null;
    const [picked, setPicked] = useState(null); // 'yyyy-MM-01'; null = this month
    const month = picked ?? thisMonth;

    const expenses = useAsync(() => (month ? listExpenses(month) : nothing()), [month]);
    const previous = useAsync(() => (month ? listExpenses(prevMonth(month)) : nothing()), [month]);
    // This month's rows tell which recurring costs are in already (when another month is shown).
    const current = useAsync(() => (isAdmin && thisMonth && month !== thisMonth ? listExpenses(thisMonth) : nothing()), [isAdmin, thisMonth, month]);
    const recurring = useAsync(() => (isAdmin ? listRecurring() : Promise.resolve([])), [isAdmin]);
    const classes = useAsync(listClassOptions, []);

    const receiptPaths = (expenses.data ?? []).map((row) => row.receipt_path).filter(Boolean).sort().join('\n');
    const receipts = useAsync(() => signReceiptUrls(receiptPaths ? receiptPaths.split('\n') : []), [receiptPaths]);

    const [filters, setFilters] = useState(NO_FILTERS);
    const [dialog, setDialog] = useState(null); // { kind: 'expense' | 'recurring', item? }
    const [viewing, setViewing] = useState(null); // the expense whose receipt is open (over a dialog too)
    const [busyId, setBusyId] = useState(null);

    const running = Boolean(month) && month === thisMonth;
    const summary = useMemo(
        () => summarize(expenses.data ?? [], previous.data ?? [], running && today.data ? sameDayLastMonth(today.data) : null),
        [expenses.data, previous.data, running, today.data],
    );
    const classImages = useMemo(() => new Map((classes.data ?? []).map((cls) => [cls.id, cls.image_path])), [classes.data]);
    const thisMonthRows = month === thisMonth ? expenses.data : current.data;
    const addedIds = useMemo(() => new Set((thisMonthRows ?? []).map((row) => row.recurring_id).filter(Boolean)), [thisMonthRows]);
    const recurringById = useMemo(() => new Map((recurring.data ?? []).map((item) => [item.id, item])), [recurring.data]);

    const pickMonth = (value) => {
        setPicked(value === thisMonth ? null : value);
        setFilters(NO_FILTERS);
    };
    const filter = (patch) => setFilters((old) => ({ ...old, ...patch }));

    const reloadMonths = () => {
        expenses.reload();
        previous.reload();
        if (current.data) current.reload();
    };

    // Runs one write; true when it worked.
    const run = async (id, action, message) => {
        setBusyId(id);
        try {
            const result = await action();
            const text = typeof message === 'function' ? message(result) : message;
            if (text) toast.success(text);
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    // ---- Expenses -------------------------------------------------------------------------

    // Saves the row, then its receipt (the upload needs the id). If only the receipt fails the
    // cost is kept and the dialog stays open on it, so the upload can be tried again.
    const saveExpense = async (existing, fields, receipt) => {
        let row;
        try {
            row = existing ? await updateExpense(existing.id, fields) : await createExpense(fields);
        } catch (error) {
            toast.error(error);
            return;
        }
        try {
            if (receipt.file) row = await attachReceipt(row, receipt.file);
            else if (receipt.remove && row.receipt_path) row = await removeReceipt(row);
        } catch (error) {
            toast.error(error);
            reloadMonths();
            setDialog({ kind: 'expense', item: row });
            return;
        }
        const otherMonth = row.month !== month;
        toast.success(
            otherMonth
                ? t('Saved in {month}.', { month: monthName(row.month, { withYear: true }) })
                : existing
                    ? t('Expense saved.')
                    : t('{amount} added.', { amount: formatVnd(row.amount) }),
        );
        setDialog(null);
        if (otherMonth) pickMonth(row.month);
        else reloadMonths();
    };

    const removeExpense = (expense) => {
        const source = expense.recurring_id ? recurringById.get(expense.recurring_id) : null;
        // While its recurring cost runs, the nightly check would add this month's copy again.
        const comesBack = source?.active && expense.month === thisMonth && (!source.ends_on || source.ends_on >= thisMonth);
        const name = expenseTitle(expense, t);
        let question = comesBack
            ? t('Delete this month’s “{name}”? Its recurring cost is still running, so the nightly check adds it again. To skip a month, pause the recurring cost instead.', { name })
            : t('Delete “{name}” ({amount})? This can’t be undone.', { name, amount: formatVnd(expense.amount) });
        // The nightly check charges a session's rent again while the session stands.
        if (isAutomaticRent(expense)) question = t('Delete “{name}”? That session’s rent won’t be charged again. If the session didn’t happen, call it off instead: that takes its rent off too.', { name });
        if (!window.confirm(question)) return;
        run(expense.id, () => deleteExpenseAndReceipt(expense), t('Expense deleted.')).then((done) => done && reloadMonths());
    };

    // ---- Recurring --------------------------------------------------------------------------

    const afterRecurring = (done) => {
        if (!done) return false;
        recurring.reload();
        return true;
    };

    const saveRecurringItem = async (item, fields) => {
        const done = await run(item ? `rec-${item.id}` : 'rec-new', () => saveRecurring(item?.id ?? null, fields), t('Recurring cost saved.'));
        if (afterRecurring(done)) setDialog(null);
    };

    const recurringActions = {
        onEdit: (item) => setDialog({ kind: 'recurring', item }),
        onToggle: (item) =>
            run(`rec-${item.id}`, () => saveRecurring(item.id, { active: !item.active }),
                item.active ? t('“{name}” is paused.', { name: item.description }) : t('“{name}” runs again.', { name: item.description })).then(afterRecurring),
        onEnd: (item) => {
            const name = monthName(thisMonth, { withYear: true });
            if (!window.confirm(t('End “{name}” after {month}? The months already added stay; it isn’t added from next month on.', { name: item.description, month: name }))) return;
            run(`rec-${item.id}`, () => saveRecurring(item.id, { ends_on: thisMonth < item.starts_on ? item.starts_on : thisMonth }),
                t('“{name}” ends after {month}.', { name: item.description, month: name })).then(afterRecurring);
        },
        onResume: (item) => run(`rec-${item.id}`, () => saveRecurring(item.id, { ends_on: null, active: true }), t('“{name}” runs again.', { name: item.description })).then(afterRecurring),
        onDelete: (item) => {
            if (!window.confirm(t('Delete the recurring cost “{name}”? The months already added stay in the list; it isn’t added again.', { name: item.description }))) return;
            run(`rec-${item.id}`, () => deleteRecurring(item.id), t('Recurring cost deleted.')).then((done) => {
                if (afterRecurring(done)) reloadMonths(); // its rows lose the "Monthly" link
            });
        },
    };

    const runNow = () =>
        run('run', runRecurring, (count) =>
            count
                ? t('{count} added for {month}.', { count, month: monthName(thisMonth) })
                : t('Nothing to add: every recurring cost whose day has come is in already.'),
        ).then((done) => done && reloadMonths());

    const close = () => setDialog(null);
    const classList = classes.data ?? [];

    return (
        <>
            <ExpenseOverview
                month={month}
                thisMonth={thisMonth}
                today={today.data}
                maxMonth={thisMonth ? nextMonth(thisMonth) : null}
                summary={summary}
                loading={expenses.loading || previous.loading}
                isAdmin={isAdmin}
                classImages={classImages}
                filters={filters}
                onPickMonth={pickMonth}
                onFilter={(patch) => {
                    filter(patch);
                    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    document.getElementById('expense-list')?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
                }}
                onAdd={() => setDialog({ kind: 'expense', item: null })}
            />

            <ExpenseList
                month={month}
                thisMonth={thisMonth}
                state={expenses}
                filters={filters}
                onFilter={filter}
                onClear={() => setFilters(NO_FILTERS)}
                receipts={receipts.data ?? {}}
                classImages={classImages}
                isAdmin={isAdmin}
                meId={user?.id}
                busyId={busyId}
                onAdd={() => setDialog({ kind: 'expense', item: null })}
                onEdit={(item) => setDialog({ kind: 'expense', item })}
                onDelete={removeExpense}
                onView={setViewing}
            />

            {isAdmin && (
                <RecurringCard
                    state={recurring}
                    thisMonth={thisMonth}
                    today={today.data}
                    addedIds={addedIds}
                    classImages={classImages}
                    busyId={busyId}
                    running={busyId === 'run'}
                    onAdd={() => setDialog({ kind: 'recurring', item: null })}
                    onRun={runNow}
                    {...recurringActions}
                />
            )}

            {dialog?.kind === 'expense' && (
                <ExpenseDialog
                    key={dialog.item?.id ?? 'new'}
                    expense={dialog.item}
                    today={today.data}
                    classes={classList}
                    receiptUrl={dialog.item?.receipt_path ? (receipts.data ?? {})[dialog.item.receipt_path] : null}
                    onView={() => setViewing(dialog.item)}
                    onClose={close}
                    onSave={(fields, receipt) => saveExpense(dialog.item, fields, receipt)}
                />
            )}
            {dialog?.kind === 'recurring' && (
                <RecurringDialog
                    key={dialog.item?.id ?? 'new'}
                    item={dialog.item}
                    thisMonth={thisMonth}
                    today={today.data}
                    classes={classList}
                    onClose={close}
                    onSave={(fields) => saveRecurringItem(dialog.item, fields)}
                />
            )}
            {viewing?.receipt_path && <ReceiptViewer expense={viewing} onClose={() => setViewing(null)} />}
        </>
    );
};

export default Expenses;
