import { useEffect, useState } from 'react';
import { studioTimeNow } from '@/lib/format';

// 'HH:mm' in the studio's timezone, refreshed every minute (for "live" / "late" states).
export function useStudioClock() {
    const [now, setNow] = useState(studioTimeNow);
    useEffect(() => {
        const timer = setInterval(() => setNow(studioTimeNow()), 60_000);
        return () => clearInterval(timer);
    }, []);
    return now;
}
