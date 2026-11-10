import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuAlertTriangle, LuArrowRight, LuClock, LuPartyPopper, LuQrCode } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { amountDue } from '@/services/tuition';
import { fadeUp } from '../../../../../admin-staff/components/common/motion';
import PayDialog from './PayDialog';
import { StatusPill } from './TuitionParts';
import { arrangeTuition, firstToPay, songOf, tuitionHeadline } from './tuitionData';
import { useMyTuition } from './useMyTuition';
import './tuition.scss';

const TONE_ICONS = { good: LuPartyPopper, due: LuClock, late: LuAlertTriangle };

// Student overview: the tuition of the courses running now in one strip, with the QR one tap away
// (or "all paid").
// Nothing shows before the first invoice (a brand-new guest).
const TuitionOverviewCard = () => {
    const i18n = useI18n();
    const { t } = i18n;
    const data = useMyTuition();
    const [paying, setPaying] = useState(null);

    if (data.error || (data.data && data.data.invoices.length === 0)) return null;
    if (!data.data) return <div className="adminCard tuStrip isLoading" aria-hidden="true" />;

    const { today, settings, sandbox } = data.data;
    const view = arrangeTuition(data.data);
    const headline = tuitionHeadline(view, settings, i18n);
    const Icon = TONE_ICONS[headline.tone];
    const next = firstToPay(view.toPay);

    return (
        <motion.section variants={fadeUp} initial="hidden" animate="show" className={`adminCard tuStrip tone-${headline.tone}`} aria-labelledby="overview-tuition-title">
            <span className="tuStripBadge" aria-hidden="true">
                <Icon />
            </span>
            <div className="tuStripText">
                <span className="pfEyebrow">{t('Your tuition')}</span>
                <h2 id="overview-tuition-title">{headline.title}</h2>
                {view.current.length > 0 && (
                    <ul className="tuStripClasses">
                        {view.current.map((invoice) => (
                            <li key={invoice.id}>
                                <span>
                                    {invoice.class_name}
                                    {invoice.course.title && <small> · {songOf(invoice.course.title)}</small>}
                                </span>
                                <StatusPill invoice={invoice} today={today} />
                            </li>
                        ))}
                    </ul>
                )}
                {!next && <p>{headline.text}</p>}
            </div>
            <div className="tuStripActions">
                {next && (
                    <button type="button" className="pfBtn isPrimary" onClick={() => setPaying(next)}>
                        <LuQrCode aria-hidden="true" /> {t('Pay {amount}', { amount: formatVnd(amountDue(next)) })}
                    </button>
                )}
                <Link to="/profile/tuition" className="pfMiniLink">
                    {t('See tuition')} <LuArrowRight aria-hidden="true" />
                </Link>
            </div>

            {paying && (
                <PayDialog
                    invoice={paying}
                    settings={settings}
                    sandbox={sandbox}
                    onClose={() => {
                        setPaying(null);
                        data.refresh();
                    }}
                />
            )}
        </motion.section>
    );
};

export default TuitionOverviewCard;
