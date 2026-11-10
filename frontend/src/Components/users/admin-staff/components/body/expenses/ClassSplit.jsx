import { motion } from 'framer-motion';
import { formatVnd } from '@/lib/format';
import { classImageUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import placeholder from '@/assets/images/logo-mark.webp';
import { SERIES } from '../../common/chartTheme';
import { EASE_OUT } from '../../common/motion';

// Class-tied costs are the point (they lower a class's margin), shared ones are context:
// accent + grey. The figures are in the rows under the bar, so the bar itself carries no text.
const TIED = SERIES[1];
const SHARED = 'hsl(20, 8%, 80%)';

const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

const ClassSplit = ({ total, tied, shared, classes, classImages, active, onPick }) => {
    const { t } = useI18n();
    const tiedShare = total ? (tied / total) * 100 : 0;

    return (
        <section className="exPanel exSplit" aria-labelledby="ex-split-title">
            <header className="exPanelHead">
                <h3 id="ex-split-title">{t('Classes vs shared')}</h3>
            </header>

            <div
                className="exSplitBar"
                role="img"
                aria-label={t('{tied} tied to classes ({tiedPct}%), {shared} shared ({sharedPct}%).', {
                    tied: formatVnd(tied),
                    tiedPct: pct(tied, total),
                    shared: formatVnd(shared),
                    sharedPct: pct(shared, total),
                })}
            >
                {total > 0 ? (
                    <>
                        {tied > 0 && (
                            <motion.span style={{ background: TIED }} initial={{ width: 0 }} animate={{ width: `${tiedShare}%` }} transition={{ duration: 0.6, ease: EASE_OUT }} />
                        )}
                        {shared > 0 && <span style={{ background: SHARED, flex: 1 }} />}
                    </>
                ) : (
                    <span className="isEmpty" />
                )}
            </div>

            <dl className="exSplitKeys">
                <div>
                    <dt>
                        <i style={{ background: TIED }} aria-hidden="true" />
                        {t('Tied to classes')}
                    </dt>
                    <dd>
                        <strong>{formatVnd(tied)}</strong>
                        <small>{`${pct(tied, total)}%`}</small>
                    </dd>
                </div>
                <div>
                    <dt>
                        <i style={{ background: SHARED }} aria-hidden="true" />
                        {t('Shared')}
                    </dt>
                    <dd>
                        <strong>{formatVnd(shared)}</strong>
                        <small>{`${pct(shared, total)}%`}</small>
                    </dd>
                </div>
            </dl>

            {classes.length > 0 ? (
                <ul className="exClassTotals" aria-label={t('Costs per class')}>
                    {classes.map((cls) => (
                        <li key={cls.id}>
                            <button
                                type="button"
                                className={String(active) === String(cls.id) ? 'isActive' : undefined}
                                aria-pressed={String(active) === String(cls.id)}
                                aria-label={t('{name}: {amount}. Show only its costs.', { name: cls.name, amount: formatVnd(cls.amount) })}
                                onClick={() => onPick(String(active) === String(cls.id) ? 'all' : String(cls.id))}
                            >
                                <img src={classImageUrl(classImages.get(cls.id)) ?? placeholder} alt="" />
                                <span>{cls.name}</span>
                                <strong>{formatVnd(cls.amount)}</strong>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="exPanelEmpty">{t('Nothing is tied to a class this month. Costs for one class’s shoot (camera crew, costumes, a venue) belong to that class.')}</p>
            )}
        </section>
    );
};

export default ClassSplit;
