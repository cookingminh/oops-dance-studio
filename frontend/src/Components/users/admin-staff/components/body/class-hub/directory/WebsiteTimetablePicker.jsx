import { useId, useRef, useState } from 'react';
import { LuCheck, LuExternalLink, LuGlobe } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getSiteSettings, setTimetableTemplate } from '@/services/site';
import { levelOf } from '@/lib/classLevel';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { TIMETABLE_LOOKS, timetableLookLabel } from '../hubModel';

// Tiny pictures of each look, pure CSS (classHub.scss .hubLookThumb): the poster's dark grid with a dot per class in
// its level's colour, and the red card's yellow brush strokes.
const POSTER_CELLS = ['newbie', '', 'basic', 'advanced', '', 'basic', 'newbie', '', 'advanced', 'basic', '', 'newbie'];
const BRUSH_COLUMNS = [2, 3, 2];
const Thumb = ({ look }) =>
    look === 'poster' ? (
        <span className="hubLookThumb isPoster" aria-hidden="true">
            {POSTER_CELLS.map((level, index) => (
                <i key={index} style={level ? { '--dot': levelOf(level).color } : undefined} />
            ))}
        </span>
    ) : (
        <span className="hubLookThumb isBrush" aria-hidden="true">
            {BRUSH_COLUMNS.map((strokes, column) => (
                <span key={column}>
                    {Array.from({ length: strokes }, (_, index) => (
                        <i key={index} />
                    ))}
                </span>
            ))}
        </span>
    );

// "On the website", above the directory's weekly timetable: which look the public Classes page uses. Admins and
// staff pick one and it is saved at once (shown straight away, put back if the save fails).
const WebsiteTimetablePicker = () => {
    const { t } = useI18n();
    const toast = useToast();
    const id = useId();
    const settings = useAsync(getSiteSettings, []);
    const [picked, setPicked] = useState(null);
    const saving = useRef(false);
    const buttons = useRef([]);
    const current = picked ?? settings.data?.timetable_template ?? null;
    const focusable = current ?? TIMETABLE_LOOKS[0].key;

    const pick = async (key) => {
        if (saving.current || key === current || settings.loading) return;
        const before = current;
        saving.current = true;
        setPicked(key);
        try {
            await setTimetableTemplate(key);
            toast.success(t('The website now shows the {template} timetable.', { template: t(timetableLookLabel(key)) }));
        } catch (error) {
            setPicked(before);
            toast.error(error);
        } finally {
            saving.current = false;
        }
    };

    // Radio keys: an arrow moves to the other look and picks it.
    const onKeyDown = (event, index) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = (index + step + TIMETABLE_LOOKS.length) % TIMETABLE_LOOKS.length;
        buttons.current[next]?.focus();
        pick(TIMETABLE_LOOKS[next].key);
    };

    return (
        <section className="hubSiteLook" aria-labelledby={`${id}-title`} aria-busy={settings.loading || undefined}>
            <div className="hubSiteLookHead">
                <span className="hubSiteLookIcon" aria-hidden="true">
                    <LuGlobe />
                </span>
                <div className="hubSiteLookTitles">
                    <h3 id={`${id}-title`}>{t('On the website')}</h3>
                    <p>{t('How the Classes page shows the timetable.')}</p>
                    <a className="hubLink" href="/classes#timetable" target="_blank" rel="noreferrer">
                        {t('See it on the website')}
                        <LuExternalLink aria-hidden="true" />
                        <span className="sr-only"> {t('(opens in a new tab)')}</span>
                    </a>
                </div>
            </div>
            <div className="hubLooks" role="radiogroup" aria-labelledby={`${id}-title`}>
                {TIMETABLE_LOOKS.map((look, index) => {
                    const checked = current === look.key;
                    return (
                        <button
                            key={look.key}
                            ref={(node) => {
                                buttons.current[index] = node;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-labelledby={`${id}-${look.key}`}
                            aria-describedby={`${id}-${look.key}-text`}
                            tabIndex={look.key === focusable ? 0 : -1}
                            className={`hubLook${checked ? ' isSelected' : ''}`}
                            onClick={() => pick(look.key)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                        >
                            <Thumb look={look.key} />
                            <span className="hubLookText">
                                <span className="hubLookName">
                                    <strong id={`${id}-${look.key}`}>{t(look.label)}</strong>
                                    {checked && (
                                        <span className="hubTag isInUse" aria-hidden="true">
                                            <LuCheck />
                                            <span>{t('In use')}</span>
                                        </span>
                                    )}
                                </span>
                                <small id={`${id}-${look.key}-text`}>{t(look.text)}</small>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default WebsiteTimetablePicker;
