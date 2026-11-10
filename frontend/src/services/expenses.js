import { supabase } from '@/lib/supabase';
import { extensionFor, prepareImage } from '@/lib/image';
import { BUCKETS, removeFiles } from './storage';
import { toAppError, unwrap } from './errors';

// Expenses: every cost that isn't payroll — supabase/migrations/20261113000100_switch_and_expenses.sql,
// api-contract §3 "Expenses". Categories: src/lib/expenseCategories.js.
//
// Expense { id, spent_on 'yyyy-MM-dd', month 'yyyy-MM-01' (generated), category, amount, description,
//   vendor, class_id (a cost that belongs to one class: camera crew for its shoot, its costumes…),
//   method 'transfer' | 'cash' | null, receipt_path (private bucket `receipts`), recurring_id,
//   created_by, created_at, updated_at, class: { id, name } | null, author: { id, full_name, username } | null }
//
// RLS: admins see and change everything; staff add petty costs and see / change only their own.
// Recurring expenses (rent, internet…) are admin only; the daily job adds each on its day of the month.

const EXPENSE = `id, spent_on, month, category, amount, description, vendor, class_id, method, receipt_path, recurring_id,
    created_by, created_at, updated_at, class:classes!class_id(id, name), author:profiles!created_by(id, full_name, username)`;

const FIELDS = ['spent_on', 'category', 'amount', 'description', 'vendor', 'class_id', 'method'];

function toRow(fields) {
    const row = {};
    for (const key of FIELDS) {
        if (!(key in fields)) continue;
        const value = typeof fields[key] === 'string' ? fields[key].trim() : fields[key];
        row[key] = value === '' ? null : value;
    }
    return row;
}

// A month's expenses ('yyyy-MM-01'), newest first. Optional filters: category, classId.
export async function listExpenses(month, { category = null, classId = null } = {}) {
    let query = supabase.from('expenses').select(EXPENSE).eq('month', month).order('spent_on', { ascending: false }).order('id', { ascending: false });
    if (category) query = query.eq('category', category);
    if (classId) query = query.eq('class_id', classId);
    return unwrap(await query);
}

export async function createExpense(fields) {
    return unwrap(await supabase.from('expenses').insert(toRow(fields)).select(EXPENSE).single());
}

export async function updateExpense(id, fields) {
    return unwrap(await supabase.from('expenses').update(toRow(fields)).eq('id', id).select(EXPENSE).single());
}

// The receipt goes first: storage only lets you remove it while its expense row still exists.
export async function deleteExpense(expense) {
    await removeFiles(BUCKETS.receipts, [expense.receipt_path]);
    unwrap(await supabase.from('expenses').delete().eq('id', expense.id));
}

// ---- Receipts (photo or PDF, max 5 MB) ------------------------------------------------

// Uploads the receipt of an existing expense and stores its path; replaces an older one.
export async function attachReceipt(expense, file) {
    const isPdf = file.type === 'application/pdf';
    const prepared = isPdf ? file : await prepareImage(file);
    const path = `${expense.id}/${crypto.randomUUID()}.${isPdf ? 'pdf' : extensionFor(prepared)}`;
    const { error } = await supabase.storage.from(BUCKETS.receipts).upload(path, prepared, { contentType: prepared.type, cacheControl: '3600' });
    if (error) throw toAppError(error);
    const updated = unwrap(await supabase.from('expenses').update({ receipt_path: path }).eq('id', expense.id).select(EXPENSE).single());
    await removeFiles(BUCKETS.receipts, [expense.receipt_path]);
    return updated;
}

export async function removeReceipt(expense) {
    const updated = unwrap(await supabase.from('expenses').update({ receipt_path: null }).eq('id', expense.id).select(EXPENSE).single());
    await removeFiles(BUCKETS.receipts, [expense.receipt_path]);
    return updated;
}

// A short-lived link to view a receipt (private bucket).
export async function receiptUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKETS.receipts).createSignedUrl(path, 3600);
    if (error) throw toAppError(error);
    return data.signedUrl;
}

// ---- Recurring (admin) ---------------------------------------------------------------

// { id, category, amount, description, vendor, class_id, method, day_of_month (1–28), starts_on, ends_on,
//   active, created_at, class: { id, name } | null }
export async function listRecurring() {
    return unwrap(
        await supabase
            .from('recurring_expenses')
            .select('id, category, amount, description, vendor, class_id, method, day_of_month, starts_on, ends_on, active, created_at, class:classes!class_id(id, name)')
            .order('active', { ascending: false })
            .order('amount', { ascending: false })
    );
}

const RECURRING_FIELDS = ['category', 'amount', 'description', 'vendor', 'class_id', 'method', 'day_of_month', 'starts_on', 'ends_on', 'active'];

function toRecurringRow(fields) {
    const row = {};
    for (const key of RECURRING_FIELDS) {
        if (!(key in fields)) continue;
        const value = typeof fields[key] === 'string' ? fields[key].trim() : fields[key];
        row[key] = value === '' ? null : value;
    }
    return row;
}

export async function saveRecurring(id, fields) {
    const row = toRecurringRow(fields);
    const query = id ? supabase.from('recurring_expenses').update(row).eq('id', id) : supabase.from('recurring_expenses').insert(row);
    return unwrap(await query.select().single());
}

export async function deleteRecurring(id) {
    unwrap(await supabase.from('recurring_expenses').delete().eq('id', id));
}

// Adds this month's recurring costs whose day has come (also runs daily on its own). Returns how many.
export async function runRecurring() {
    return unwrap(await supabase.rpc('expenses_run_recurring'));
}
