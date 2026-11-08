import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// "Today" in the studio's timezone (Asia/Ho_Chi_Minh), as 'yyyy-MM-dd'. Never use the client clock.
export async function getStudioToday() {
    return unwrap(await supabase.rpc('studio_today'));
}
