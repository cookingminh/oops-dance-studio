import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// The website's choices (site_settings, one row; supabase/migrations/20261117001500_timetable_templates.sql).
// Everyone reads them; admins and staff change the timetable's look.

// 'poster' (the printed schedule's grid) | 'brush' (the red card).
export const TIMETABLE_TEMPLATES = ['poster', 'brush'];
export const DEFAULT_TIMETABLE_TEMPLATE = 'poster';

export async function getSiteSettings() {
    return unwrap(await supabase.from('site_settings').select('timetable_template, updated_at, updated_by').eq('id', 1).maybeSingle());
}

// Which look the public timetable uses; the default when it can't be read.
export async function getTimetableTemplate() {
    try {
        const row = await getSiteSettings();
        return TIMETABLE_TEMPLATES.includes(row?.timetable_template) ? row.timetable_template : DEFAULT_TIMETABLE_TEMPLATE;
    } catch {
        return DEFAULT_TIMETABLE_TEMPLATE;
    }
}

export async function setTimetableTemplate(template) {
    return unwrap(await supabase.rpc('site_set_timetable_template', { p_template: template }));
}
