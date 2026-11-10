import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import CountUp from '../../../common/CountUp';
import { fadeUp, stagger } from '../../../common/motion';
import { INSIGHTS, KINDS, KIND_ORDER } from '../peopleModel';

const TILES = [
    ...KIND_ORDER.map((key) => ({ key, label: KINDS[key].plural, icon: KINDS[key].icon, tone: KINDS[key].tone })),
    ...Object.entries(INSIGHTS).map(([key, insight]) => ({ key, ...insight })),
];

// Head counts per role plus "new this month" and "missing details". Each tile is a filter;
// pressing the selected one again shows everyone.
const PeopleOverview = ({ counts, view, onChange }) => {
    const { t } = useI18n();
    return (
        <motion.div className="peopleStrip" role="group" aria-label={t('Filter people')} variants={stagger}>
            {TILES.map((tile) => {
                const Icon = tile.icon;
                const pressed = view === tile.key;
                return (
                    <motion.button
                        key={tile.key}
                        type="button"
                        variants={fadeUp}
                        className={`stripTile${tile.key in INSIGHTS ? ' isInsight' : ''}`}
                        data-tone={tile.tone}
                        aria-pressed={pressed}
                        onClick={() => onChange(pressed ? 'all' : tile.key)}
                    >
                        <span className="tileTop">
                            <span className="tileIcon" aria-hidden="true">
                                <Icon />
                            </span>
                            <span className="tileValue">{counts ? <CountUp value={counts[tile.key] ?? 0} duration={0.8} /> : '…'}</span>
                        </span>
                        <span className="tileLabel">{t(tile.label)}</span>
                    </motion.button>
                );
            })}
        </motion.div>
    );
};

export default PeopleOverview;
