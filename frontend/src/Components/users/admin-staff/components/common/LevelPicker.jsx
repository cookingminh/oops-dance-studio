import { useId, useRef } from 'react';
import { LEVELS, NO_LEVEL } from '@/lib/classLevel';
import { circleOf } from '@/ui/timetable/timetableFrame';
import { useI18n } from '@/i18n/i18nContext';

const OPTIONS = [...LEVELS, NO_LEVEL];

// A class's level as a row of chips, each with the brush circle the website timetable paints it in
// ('' = no level). A radio group: arrow keys move and pick, only the picked chip is in the tab order.
const LevelPicker = ({ value, onChange, label, hint }) => {
    const { t } = useI18n();
    const refs = useRef([]);
    const labelId = useId();
    const current = Math.max(
        OPTIONS.findIndex((level) => (level.value ?? '') === (value || '')),
        0,
    );

    const move = (event, index) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = (index + step + OPTIONS.length) % OPTIONS.length;
        onChange(OPTIONS[next].value ?? '');
        refs.current[next]?.focus();
    };

    return (
        <div className="ncLevelField">
            <span className="ncFieldLabel" id={labelId}>
                {label ?? t('Level')}
            </span>
            <div className="ncLevels" role="radiogroup" aria-labelledby={labelId}>
                {OPTIONS.map((level, index) => {
                    const on = index === current;
                    return (
                        <button
                            key={level.value ?? 'none'}
                            ref={(node) => (refs.current[index] = node)}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            tabIndex={on ? 0 : -1}
                            className={`ncLevel${on ? ' isOn' : ''}${level.value ? '' : ' isNone'}`}
                            style={{ '--lvl': level.color }}
                            onClick={() => onChange(level.value ?? '')}
                            onKeyDown={(event) => move(event, index)}
                        >
                            <i style={{ backgroundImage: `url(${circleOf(level.value)})` }} aria-hidden="true" />
                            {t(level.label)}
                        </button>
                    );
                })}
            </div>
            {hint && <p className="ncHint">{hint}</p>}
        </div>
    );
};

export default LevelPicker;
