import { categoryOf } from '@/lib/expenseCategories';
import { hasActivity } from './reportModel';

const MAX_ITEMS = 6;

// Up to six short sentences an owner would say about the focused month. Each:
// { key, tone: 'good' | 'bad' | 'neutral', text }. `classes` is finance_by_class for the month,
// `openCount` the number of unpaid invoices, `next` next month's row (renewal open early),
// `expenses` / `prevExpenses` the month's and the month before's expenses by category
// (biggest first). Every candidate gets a rank (lower = more important); the best six are
// kept and shown in topic order: money in, profit, costs, classes, people, payments.
export function buildInsights({ cur, prev, classes = [], openCount, next, expenses = [], prevExpenses = [], t, tn, fmt }) {
    if (!cur) return [];
    const items = [];
    const add = (key, tone, text, rank) => items.push({ key, tone, text, rank, order: items.length });
    const prevName = prev ? fmt.monthName(prev.month) : '';
    const curName = fmt.monthName(cur.month);
    const soFar = cur.inProgress;

    const best = [...classes].filter((row) => row.margin > 0).sort((a, b) => b.margin - a.margin)[0];
    const losing = classes.filter((row) => row.margin < 0).sort((a, b) => a.margin - b.margin);
    // A class that still earns, but whose own costs (its shoot, its costumes) took a real bite.
    const costly = classes.filter((row) => row.direct_costs > 0 && row.margin >= 0).sort((a, b) => b.direct_costs - a.direct_costs)[0];

    const open = (rank) => {
        if (cur.tuition_outstanding <= 0) return;
        const amount = fmt.short(cur.tuition_outstanding);
        const text = openCount
            ? tn(openCount, '{count} invoice ({amount}) still open', '{count} invoices ({amount}) still open', { amount })
            : t('{amount} of tuition still open', { amount });
        const overdue = cur.invoices_overdue > 0 ? ` · ${tn(cur.invoices_overdue, '{count} overdue', '{count} overdue')}` : '';
        add('open', cur.invoices_overdue > 0 ? 'bad' : 'neutral', `${text}${overdue}`, cur.invoices_overdue > 0 ? Math.min(rank, 4.5) : rank);
    };

    // People, not enrolments: a class switch keeps the student, so it is said apart.
    const retention = (rank) => {
        if (cur.retention === null) return;
        const rate = fmt.pct(cur.retention);
        const tone = cur.retention >= 0.9 ? 'good' : cur.retention >= 0.75 ? 'neutral' : 'bad';
        const parts = [
            cur.students_left > 0
                ? tn(cur.students_left, 'Retention {rate} ({count} student left)', 'Retention {rate} ({count} students left)', { rate })
                : t('Retention {rate}: everyone stayed', { rate }),
        ];
        if (cur.students_new > 0) parts.push(tn(cur.students_new, '{count} new student', '{count} new students'));
        if (cur.class_switches > 0) parts.push(tn(cur.class_switches, '{count} class switch, not counted as leaving', '{count} class switches, not counted as leaving'));
        add('retention', tone, parts.join(' · '), cur.class_switches > 0 || tone === 'bad' ? Math.min(rank, 3.5) : rank);
    };

    const biggestExpense = (rank) => {
        const top = expenses[0];
        if (!top || cur.expenses_total <= 0) return;
        const vars = { category: t(categoryOf(top.category).label), amount: fmt.short(top.amount), pct: fmt.pct(top.amount / cur.expenses_total) };
        add(
            'expense',
            'neutral',
            soFar ? t('{category} is the biggest expense so far ({amount}, {pct} of expenses)', vars) : t('{category} is the biggest expense ({amount}, {pct} of expenses)', vars),
            rank
        );
    };

    // Only a real move (5 % or more), with the category that moved the most.
    const expenseChange = (rank) => {
        if (!hasActivity(prev) || !(prev.expenses_total > 0)) return;
        const change = (cur.expenses_total - prev.expenses_total) / prev.expenses_total;
        if (Math.abs(change) < 0.05) return;
        const vars = { pct: fmt.pct(Math.abs(change)), month: prevName, amount: fmt.short(cur.expenses_total) };
        let text = change > 0 ? t('Expenses up {pct} on {month}, to {amount}', vars) : t('Expenses down {pct} on {month}, to {amount}', vars);
        const before = new Map(prevExpenses.map((row) => [row.category, row.amount]));
        const deltas = new Map([...before.keys(), ...expenses.map((row) => row.category)].map((key) => [key, (expenses.find((row) => row.category === key)?.amount ?? 0) - (before.get(key) ?? 0)]));
        const [driver, delta] = [...deltas.entries()].sort((a, b) => (change > 0 ? b[1] - a[1] : a[1] - b[1]))[0] ?? [];
        if (driver && Math.sign(delta) === Math.sign(change)) {
            const category = t(categoryOf(driver).label);
            text += ` · ${delta > 0 ? t('mostly {category} (+{amount})', { category, amount: fmt.short(delta) }) : t('mostly {category} (−{amount})', { category, amount: fmt.short(-delta) })}`;
        }
        add('expenseChange', change > 0 ? 'bad' : 'good', text, rank);
    };

    const losingClasses = (rank) => {
        if (losing.length === 1) {
            const [row] = losing;
            const vars = { name: row.class_name, amount: fmt.short(row.margin), costs: fmt.short(row.direct_costs) };
            add(
                'losing',
                'bad',
                row.direct_costs > 0 ? t('{name} costs more than it brings in ({amount}, after {costs} of class costs)', vars) : t('{name} costs more than it brings in ({amount})', vars),
                rank
            );
        } else if (losing.length > 1) {
            add('losing', 'bad', t('{count} classes cost more than they bring in: {names}', { count: losing.length, names: losing.map((row) => row.class_name).join(', ') }), rank);
        }
    };

    const classCosts = (rank) => {
        if (!costly) return;
        add('classCosts', 'neutral', t('Costs tied to {name} ({costs}) cut its margin to {margin}', { name: costly.class_name, costs: fmt.short(costly.direct_costs), margin: fmt.short(costly.margin) }), rank);
    };

    if (soFar) {
        if (cur.collectionRate !== null) {
            add('collected', 'neutral', t('{rate} of {month}’s tuition collected so far ({amount})', {
                rate: fmt.pct(cur.collectionRate),
                month: curName,
                amount: fmt.short(cur.tuition_collected),
            }), 1);
        }
        open(2);
        if (next && next.tuition_billed > 0) {
            const amount = fmt.short(next.tuition_collected);
            const month = fmt.monthName(next.month);
            add(
                'next',
                'good',
                next.enrolments_ended > 0
                    ? tn(next.enrolments_ended, '{month} renewal is open: {amount} paid in advance, {count} enrolment stopping', '{month} renewal is open: {amount} paid in advance, {count} enrolments stopping', { month, amount })
                    : t('{month} renewal is open: {amount} paid in advance', { month, amount }),
                3
            );
        }
        biggestExpense(5);
        losingClasses(6);
        if (best) add('best', 'good', t('{name} brings the most margin so far ({amount})', { name: best.class_name, amount: fmt.short(best.margin) }), 7);
        retention(4);
    } else {
        // A full month: how it went against the one before.
        if (hasActivity(prev) && prev.revenue > 0) {
            const change = (cur.revenue - prev.revenue) / prev.revenue;
            const pct = fmt.pct(Math.abs(change));
            if (Math.abs(change) < 0.005) add('revenue', 'neutral', t('Revenue about the same as {month} ({amount})', { month: prevName, amount: fmt.short(cur.revenue) }), 1);
            else if (change > 0) add('revenue', 'good', t('Revenue up {pct} on {month}, to {amount}', { pct, month: prevName, amount: fmt.short(cur.revenue) }), 1);
            else add('revenue', 'bad', t('Revenue down {pct} on {month}, to {amount}', { pct, month: prevName, amount: fmt.short(cur.revenue) }), 1);
        } else {
            add('revenue', 'neutral', t('Revenue {amount} in {month}', { amount: fmt.short(cur.revenue), month: curName }), 1);
        }

        if (cur.profit < 0) {
            add('profit', 'bad', t('{month} ran at a loss of {amount} after {costs} of costs', { month: curName, amount: fmt.short(Math.abs(cur.profit)), costs: fmt.short(cur.costs_total) }), 2);
        } else if (cur.margin !== null) {
            add('profit', cur.margin >= 0.2 ? 'good' : 'neutral', t('Profit {amount} after {costs} of costs ({pct} margin)', { amount: fmt.short(cur.profit), costs: fmt.short(cur.costs_total), pct: fmt.pct(cur.margin) }), 2);
        }
        biggestExpense(4);
        expenseChange(6);
        losingClasses(3);
        classCosts(7);
        if (best) add('best', 'good', t('{name} brings the most margin ({amount})', { name: best.class_name, amount: fmt.short(best.margin) }), 8);
        retention(5);
        open(9);
        if (cur.transferShare !== null) add('transfer', 'neutral', t('{pct} of tuition paid by bank transfer', { pct: fmt.pct(cur.transferShare) }), 10);
    }

    return [...items]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_ITEMS)
        .sort((a, b) => a.order - b.order)
        .map(({ key, tone, text }) => ({ key, tone, text }));
}
