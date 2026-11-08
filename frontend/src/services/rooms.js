import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// image_paths: ordered photo paths in the site-assets bucket, first = cover (api-contract §3, §7).
const ROOM_COLUMNS = 'id, name, size, price, image_paths';

export async function listRooms() {
    return unwrap(await supabase.from('rooms').select(ROOM_COLUMNS).order('id'));
}

export async function updateRoom(id, { name, size, price }) {
    return unwrap(
        await supabase
            .from('rooms')
            .update({ name: name.trim(), size: size?.trim() || null, price: Number(price) })
            .eq('id', id)
            .select(ROOM_COLUMNS)
            .single()
    );
}
