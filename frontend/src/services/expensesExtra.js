import { supabase } from '@/lib/supabase';
import { BUCKETS, removeFiles } from './storage';
import { deleteExpense } from './expenses';
import { unwrap } from './errors';

// Extra calls for the expenses page (/admin/expenses); expenses.js (the lead's) holds the rest.

// Every class, for the "only for one class?" picker and the class chips (RLS: everyone reads classes).
export async function listClassOptions() {
    return unwrap(await supabase.from('classes').select('id, name, image_path').order('name'));
}

// Short-lived links for many receipts at once (one request per list): { [path]: signedUrl }.
// RLS on the private bucket only signs receipts of expenses the reader can see.
export async function signReceiptUrls(paths) {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return {};
    const { data, error } = await supabase.storage.from(BUCKETS.receipts).createSignedUrls(unique, 3600);
    if (error) return {}; // thumbnails are a nicety: rows fall back to a paperclip
    return Object.fromEntries((data ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
}

// Deletes an expense and its receipt. The receipt goes first: storage RLS only lets someone who
// can see the expense touch its file, so once the row is gone the file could no longer be removed
// (expenses.deleteExpense removes it after the row and would leave it behind).
export async function deleteExpenseAndReceipt(expense) {
    if (expense.receipt_path) await removeFiles(BUCKETS.receipts, [expense.receipt_path]);
    await deleteExpense({ ...expense, receipt_path: null });
}
