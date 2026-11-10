import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { INVOICE } from './tuition';

// Read-only lookups for the staff tuition page's search (/admin/tuition). The page's lists come
// from loadTuitionBoard (./tuitionStaff.js); this finds what isn't in them. RLS: staff and admins
// read every invoice (tuition_invoices_select).

const PERSON = 'id, username, full_name, email, contact_number, avatar_path, updated_at';
const CLASS = 'id, name, image_path, price, instructor_id';
const COURSE = 'course:class_lessons!lesson_id(id, title, starts_on, session_count, price, video_url)';

// One invoice by its payment code ('OOPS7K3M9Q'), any course and any status, with the student, the
// class and the course — or null. Room bookings share the code namespace: see findBooking
// (./bookingPayments.js).
export async function findInvoiceByCode(code) {
    const text = String(code ?? '').trim().toUpperCase();
    if (!text) return null;
    return unwrap(
        await supabase
            .from('tuition_invoices')
            .select(`${INVOICE}, student:profiles!student_id(${PERSON}), class:classes!class_id(${CLASS}), ${COURSE}`)
            .eq('payment_code', text)
            .maybeSingle()
    );
}
