import { motion } from 'framer-motion';
import { LuAlertTriangle, LuClock, LuPartyPopper, LuQrCode } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { fadeUp } from '../../../../../admin-staff/components/common/motion';
import { firstToPay, tuitionHeadline } from './tuitionData';

const TONE_ICONS = { good: LuPartyPopper, due: LuClock, late: LuAlertTriangle };

// The answer to "do I owe anything?" before anything else: a headline, a friendly next step and
// what's left to pay with one button (or what was paid this year once everything is paid).
const TuitionHero = ({ view, settings, onPay }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const headline = tuitionHeadline(view, settings, i18n);
    const Icon = TONE_ICONS[headline.tone];
    const next = firstToPay(view.toPay);

    return (
        <motion.section variants={fadeUp} className={`tuHero tone-${headline.tone}`} aria-labelledby="tuition-headline">
            <div className="tuHeroMain">
                <span className="tuHeroBadge" aria-hidden="true">
                    <Icon />
                </span>
                <div className="tuHeroText">
                    <span className="pfEyebrow">{t('Your tuition')}</span>
                    <h2 id="tuition-headline">{headline.title}</h2>
                    <p>{headline.text}</p>
                </div>
            </div>

            <div className="tuHeroSide">
                {next ? (
                    <>
                        <span className="tuHeroLabel">{t('Left to pay')}</span>
                        <strong className="tuHeroAmount">{formatVnd(view.left)}</strong>
                        <button type="button" className="pfBtn isPrimary tuHeroPay" onClick={() => onPay(next)}>
                            <LuQrCode aria-hidden="true" /> {view.toPay.length > 1 ? t('Pay {className}', { className: next.class_name }) : t('Pay now')}
                        </button>
                    </>
                ) : (
                    <>
                        <span className="tuHeroLabel">{t('Paid in {year}', { year: view.year })}</span>
                        <strong className="tuHeroAmount">{formatVnd(view.paidThisYear)}</strong>
                        <span className="tuHeroThanks">{t('Thank you for dancing with us!')}</span>
                    </>
                )}
            </div>
        </motion.section>
    );
};

export default TuitionHero;
