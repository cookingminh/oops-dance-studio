import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Recurring room rentals, paid by month (20261117003100_booking_series; api-contract §5). Staff plan and book a
// series; each session is an ordinary booking (bookings.series_id); each month of it has a payment code.

// Every day of the series to be, with what holds the room then and the rooms still free on a clashing day:
// [{ date, clash: text | null, free_rooms: [{ id, name }] }]. `weekdays`: ISO (1 = Monday).
export async function previewSeries({ roomId, weekdays, start, end, from, until }) {
    return unwrap(
        await supabase.rpc('booking_series_preview', {
            p_room: Number(roomId),
            p_weekdays: weekdays,
            p_start: start,
            p_end: end,
            p_from: from,
            p_until: until,
        })
    );
}

// Books the series. `days`: the days kept, [{ date, room_id?, start?, end? }] (another room or other times for a day
// that clashed). `discount`: null, or { kind: 'percent' | 'amount', value, note }. For an account pass guestId, for a
// walk-in walkInName + walkInPhone. → { series, first } (the series row, and its first booking).
export async function createSeries({ guestId = null, walkInName = null, walkInPhone = null, roomId, weekdays, start, end, from, until, days, status = 'approved', discount = null, details = null }) {
    const series = unwrap(
        await supabase.rpc('booking_series_create', {
            p_guest: guestId,
            p_room: Number(roomId),
            p_weekdays: weekdays,
            p_start: start,
            p_end: end,
            p_from: from,
            p_until: until,
            p_days: days,
            p_status: status,
            p_discount_kind: discount?.kind ?? null,
            p_discount_value: discount ? Number(discount.value) : null,
            p_discount_note: discount?.note?.trim() || null,
            p_details: details?.trim() || null,
            p_walk_in_name: walkInName?.trim() || null,
            p_walk_in_phone: walkInPhone?.trim() || null,
        })
    );
    const first = unwrap(await supabase.from('bookings').select('id').eq('series_id', series.id).order('date').order('start_time').limit(1).maybeSingle());
    return { series, first };
}

// { series: { …, who, room }, months: [{ month, code, sessions, total, paid, balance }], sessions, ahead }.
export async function seriesSummary(seriesId) {
    return unwrap(await supabase.rpc('booking_series_summary', { p_series: seriesId }));
}

// Staff: money for a month taken by hand, spread over its sessions in date order. → the month's balance after.
export async function recordSeriesPayment(seriesId, month, amount, method = 'cash', note = null) {
    return unwrap(await supabase.rpc('booking_series_record_payment', { p_series: seriesId, p_month: month, p_amount: amount, p_method: method, p_note: note?.trim() || null }));
}

// Sandbox: a pretend transfer of what a month still owes, with its code.
export async function simulateSeriesTransfer(seriesId, month) {
    return unwrap(await supabase.rpc('booking_series_simulate_transfer', { p_series: seriesId, p_month: month }));
}

// Staff: cancels the sessions still ahead. `byStudio`: everything paid goes back; else the cancellation policy.
export async function cancelSeriesRest(seriesId, { byStudio = false, note = null } = {}) {
    return unwrap(await supabase.rpc('booking_series_cancel_rest', { p_series: seriesId, p_by_studio: byStudio, p_note: note?.trim() || null }));
}

// What a transfer for a month says: its code first (that is what the bank match reads).
export const seriesTransferContent = (code, month) => `${code} thue phong ${month.slice(5, 7)}/${month.slice(0, 4)}`;

export function seriesQrUrl(settings, code, month, amount) {
    if (!settings?.bank_code || !settings?.account_no || !code) return null;
    const params = new URLSearchParams({ amount: String(Math.round(amount)), addInfo: seriesTransferContent(code, month) });
    if (settings.account_name) params.set('accountName', settings.account_name);
    return `https://img.vietqr.io/image/${encodeURIComponent(settings.bank_code)}-${encodeURIComponent(settings.account_no)}-compact2.png?${params}`;
}

// The agreed price of one session from its list price and the series discount (as the server rounds it).
export function discounted(list, discount) {
    if (list === null || list === undefined) return null;
    if (!discount || !Number(discount.value)) return list;
    if (discount.kind === 'percent') return Math.round((list * (100 - Number(discount.value))) / 100 / 1000) * 1000;
    return Math.max(list - Math.round(Number(discount.value)), 0);
}
