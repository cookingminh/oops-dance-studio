import { addDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { LuBellRing, LuCalendarOff, LuCalendarPlus } from 'react-icons/lu';
import { toIsoDate } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../../../../admin-staff/components/common/motion';
import { changeWords } from '../../../../../admin-staff/components/common/session-changes/changeText';
import { changesBetween } from './routineView';
import './classChanges.scss';

const ICONS = { cancelled: LuCalendarOff, make_up: LuCalendarPlus };

// Session changes as short lines: "Off on Wed 13 Nov · Storm / bad weather", "Make-up Sat 16 Nov,
// 10:00–11:30 · Instead of Wed 13 Nov". The icon and the words both say which kind it is.
export const ChangeLines = ({ changes, className = '' }) => {
    const i18n = useI18n();
    return (
        <ul className={`pfChanges ${className}`}>
            {changes.map((change) => {
                const Icon = ICONS[change.kind] ?? LuCalendarOff;
                const words = changeWords(change, i18n);
                return (
                    <li key={`${change.kind}-${change.id}`} className={`kind-${change.kind}`}>
                        <Icon aria-hidden="true" />
                        <span>
                            <strong>{words.line}</strong>
                            <span>{words.detail}</span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

// A notice at the top of a class's view when its schedule changes in the next 7 days (a session called
// off, a make-up), so nobody turns up on the wrong day.
export const ClassChanges = ({ cls, today }) => {
    const { t } = useI18n();
    if (!today) return null;
    const changes = changesBetween(cls, today, toIsoDate(addDays(parseISO(today), 6)));
    if (!changes.length) return null;
    return (
        <motion.section variants={fadeUp} initial="hidden" animate="show" className="pfBlock pfChangeNotice" aria-label={t('Schedule changes')}>
            <header className="pfBlockHead">
                <h4>
                    <LuBellRing aria-hidden="true" /> {t('Schedule changes')}
                </h4>
                <span>{t('In the next 7 days')}</span>
            </header>
            <ChangeLines changes={changes} />
        </motion.section>
    );
};
