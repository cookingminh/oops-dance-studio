import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';

// The class page's tab row (ARIA tabs: arrow keys, Home / End). `tabs` [{ key, label, count? }].
// The panel itself is rendered by the page with id `hub-panel` and aria-labelledby `hub-tab-<key>`.
const HubTabs = ({ tabs, value, onChange }) => {
    const { t } = useI18n();
    const listRef = useRef(null);

    const onKeyDown = (event) => {
        const index = tabs.findIndex((tab) => tab.key === value);
        const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
        onChange(next.key);
        listRef.current?.querySelector(`#hub-tab-${next.key}`)?.focus();
    };

    return (
        <div className="hubTabs" role="tablist" aria-label={t('Class sections')} ref={listRef} onKeyDown={onKeyDown}>
            {tabs.map((tab) => {
                const selected = tab.key === value;
                return (
                    <button
                        key={tab.key}
                        id={`hub-tab-${tab.key}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls="hub-panel"
                        tabIndex={selected ? 0 : -1}
                        className={selected ? 'isSelected' : ''}
                        onClick={() => onChange(tab.key)}
                    >
                        <span>{t(tab.label)}</span>
                        {tab.count ? <span className="segCount">{tab.count}</span> : null}
                        {selected && <motion.span layoutId="hubTabLine" className="hubTabLine" transition={{ type: 'spring', stiffness: 500, damping: 40 }} aria-hidden="true" />}
                    </button>
                );
            })}
        </div>
    );
};

export default HubTabs;
