import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuCheck, LuFlame, LuListChecks, LuMinus, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { attendanceSummary } from '../../profileHelpers';

const STATUS_LABEL = { attend: 'Attended', absent: 'Absent', pending: 'Not marked' }; // English, translated where shown
const STATUS_ICON = { attend: LuCheck, absent: LuX, pending: LuMinus };

// Marked sessions as small tiles, oldest → newest. Icons as well as colour tell them apart.
export const RecentDots = ({ rows, size = 'md' }) => {
    const { t, formatDate } = useI18n();
    if (!rows.length) return null;
    return (
        <ol className={`pfDots size-${size}`} aria-label={t('Last {count} roll calls', { count: rows.length })}>
            {rows.map((row) => {
                const Icon = STATUS_ICON[row.status] ?? LuMinus;
                const text = `${formatDate(row.date, 'short')} · ${t(STATUS_LABEL[row.status] ?? row.status)}`;
                return (
                    <li key={row.id ?? row.date} className={`is-${row.status}`} title={text}>
                        <Icon aria-hidden="true" />
                        <span className="sr-only">{text}</span>
                    </li>
                );
            })}
        </ol>
    );
};

// Attendance rate as a ring that fills in.
export const RateRing = ({ rate, size = 84 }) => {
    const { t } = useI18n();
    const radius = (size - 10) / 2;
    const tone = rate === null ? 'none' : rate >= 80 ? 'good' : rate >= 50 ? 'okay' : 'low';
    return (
        <span className={`pfRing tone-${tone}`} style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle className="pfRingTrack" cx={size / 2} cy={size / 2} r={radius} />
                <motion.circle
                    className="pfRingValue"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: (rate ?? 0) / 100 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                />
            </svg>
            <span className="pfRingText">
                <strong>{rate === null ? '—' : `${rate}%`}</strong>
                <small>{t('attended')}</small>
            </span>
        </span>
    );
};

// The student's own attendance in one class: rate, streak and the latest roll calls.
export const StudentProgress = ({ cls, compact = false }) => {
    const { t } = useI18n();
    const summary = attendanceSummary(cls.attendance, compact ? 8 : 12);
    const marked = summary.attended + summary.absent;

    return (
        <section className="pfBlock pfProgress" aria-label={t('Your attendance in this class')}>
            <header className="pfBlockHead">
                <h4>
                    <LuListChecks aria-hidden="true" /> {t('Your attendance in this class')}
                </h4>
                {!compact && (
                    <Link to={`/profile/my-attendance?class=${cls.id}`} className="pfMiniLink">
                        {t('Full history')} <LuArrowRight aria-hidden="true" />
                    </Link>
                )}
            </header>
            {marked === 0 ? (
                <p className="pfMuted">{t('Your first roll call will show up here after class.')}</p>
            ) : (
                <>
                    <div className="pfProgressTop">
                        <RateRing rate={summary.rate} size={compact ? 72 : 88} />
                        <ul className="pfFacts">
                            <li>
                                <strong>{summary.attended}</strong> {t('attended')}
                            </li>
                            <li>
                                <strong>{summary.absent}</strong> {t('missed')}
                            </li>
                            <li className={summary.streak > 0 ? 'isStreak' : undefined}>
                                <LuFlame aria-hidden="true" /> <strong>{summary.streak}</strong> {t('in a row')}
                            </li>
                        </ul>
                    </div>
                    <RecentDots rows={summary.recent} />
                </>
            )}
        </section>
    );
};
