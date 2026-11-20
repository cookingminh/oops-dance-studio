import { LuChevronLeft, LuChevronRight, LuPause, LuPlay } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';

// The hero's slide bar: one segment per slide (filling while it shows; its name on wide screens), pause / play,
// previous and next. Phones get the segments and the pause button; they swipe for the rest.
const HeroControls = ({ labels, index, go, paused, onTogglePause, fills }) => {
    const { t } = useI18n();

    return (
        <div className="hpHeroControls">
            <div className="hpSegs" role="group" aria-label={t('Slides')}>
                {labels.map((label, i) => (
                    <button
                        key={`${i}-${label}`}
                        type="button"
                        className="hpSeg"
                        onClick={() => go(i)}
                        aria-label={t('Slide {n}: {label}', { n: i + 1, label })}
                        aria-current={i === index ? 'true' : undefined}
                    >
                        <span className="hpSegBar" aria-hidden="true">
                            <span
                                className="hpSegFill"
                                ref={(el) => {
                                    fills.current[i] = el;
                                }}
                            />
                        </span>
                        <span className="hpSegLabel" aria-hidden="true">
                            {label}
                        </span>
                    </button>
                ))}
            </div>
            <button
                type="button"
                className="hpRound hpPause"
                onClick={onTogglePause}
                aria-label={paused ? t('Play the slideshow') : t('Pause the slideshow')}
                title={paused ? t('Play the slideshow') : t('Pause the slideshow')}
            >
                {paused ? <LuPlay aria-hidden="true" /> : <LuPause aria-hidden="true" />}
            </button>
            <button type="button" className="hpRound isArrow" onClick={() => go(index - 1)} aria-label={t('Previous slide')} title={t('Previous slide')}>
                <LuChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="hpRound isArrow" onClick={() => go(index + 1)} aria-label={t('Next slide')} title={t('Next slide')}>
                <LuChevronRight aria-hidden="true" />
            </button>
        </div>
    );
};

export default HeroControls;
