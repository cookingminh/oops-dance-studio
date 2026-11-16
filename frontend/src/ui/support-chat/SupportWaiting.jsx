import { useEffect, useMemo, useState } from 'react';
import { LuHourglass } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { countdown } from './supportText';

// While nobody from the studio has taken the conversation: "Waiting for someone to join… usually within
// 5 minutes", counting down from when the person asked (support_status().reply_minutes). Past that, a
// friendly "taking a little longer" instead of a negative clock. Gone as soon as someone joins.
// `serverNow` (support_status().now) corrects a device clock that is off.
const SupportWaiting = ({ since, minutes, serverNow }) => {
    const { t, tn } = useI18n();
    const skew = useMemo(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0), [serverNow]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const left = Date.parse(since) + minutes * 60_000 - (now + skew);
    const late = left <= 0;

    return (
        <div className={`supportWaiting${late ? ' is-late' : ''}`}>
            <span className="supportWaitingIcon" aria-hidden="true">
                <LuHourglass />
            </span>
            <div className="supportWaitingText">
                <p role="status">
                    {late ? t('Taking a little longer than usual. Someone will join soon.') : t('Waiting for someone from the studio to join…')}
                </p>
                {!late && <small>{tn(minutes, 'Usually within {count} minute', 'Usually within {count} minutes')}</small>}
            </div>
            {!late && (
                <span className="supportCountdown" aria-hidden="true">
                    {countdown(left)}
                </span>
            )}
        </div>
    );
};

export default SupportWaiting;
