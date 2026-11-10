import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Extra read-only queries for the finance report (/admin/reports). finance.js holds the report RPCs.

// How many invoices for `month` ('yyyy-MM-01') are still unpaid (partly paid ones included).
// RLS: staff and admin read every invoice.
export async function countOpenInvoices(month) {
    const response = await supabase.from('tuition_invoices').select('id', { count: 'exact', head: true }).eq('month', month).eq('status', 'unpaid');
    unwrap(response); // throws on error; a head request has no rows, only the count
    return response.count ?? 0;
}
