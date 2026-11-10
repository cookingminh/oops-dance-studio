import { useEffect, useRef, useState } from 'react';
import { LuClapperboard, LuPlay } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { clipLength } from '@/services/promos';
import { youtubeEmbed } from '@/lib/youtube';
import './promo.scss';

// A promo in its frame. An uploaded clip or a YouTube Short sits in an upright 9:16 frame (a sideways
// clip in the middle, on a blurred copy of its poster); a regular YouTube video gets 16:9. Nothing loads
// before play — YouTube only after a press — except with `autoPlay` (a dialog the viewer just opened).
// `promo` is promoOf(), or { src, poster } of a local file.
export const PromoPlayer = ({ promo, title, autoPlay = false, className = '' }) => {
    const ref = useRef(null);
    const [started, setStarted] = useState(autoPlay);
    const wide = Boolean(promo.ytId) && !promo.isShort;

    // Browsers may refuse to start with sound: the controls are there, so that's fine.
    useEffect(() => {
        if (autoPlay && promo.src) ref.current?.play().catch(() => {});
    }, [autoPlay, promo.src]);

    if (promo.ytId) {
        return (
            <div className={`prPlayer isYoutube${wide ? ' isWide' : ''} ${className}`}>
                {started ? (
                    <iframe
                        src={youtubeEmbed(promo.ytId)}
                        title={title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                ) : (
                    <button type="button" className="prPlayerPoster" onClick={() => setStarted(true)} aria-label={title}>
                        <img src={promo.poster} alt="" loading="lazy" decoding="async" />
                        <span className="prThumbPlay" aria-hidden="true">
                            <LuPlay />
                        </span>
                        <SiYoutube className="prPlayerYt" aria-hidden="true" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`prPlayer ${className}`}>
            {promo.poster && <img className="prPlayerBlur" src={promo.poster} alt="" aria-hidden="true" />}
            <video
                ref={ref}
                key={promo.src}
                src={promo.src}
                poster={promo.poster ?? undefined}
                controls
                playsInline
                preload={autoPlay ? 'auto' : 'none'}
                aria-label={title}
            />
        </div>
    );
};

// A promo's poster as a play button, with the clip's length (or a YouTube mark). `hue` colours it
// when there's no poster.
export const PromoThumb = ({ promo, label, onPlay, size = 'md', hue, className = '' }) => (
    <button type="button" className={`prThumb is-${size} ${className}`} onClick={onPlay} aria-label={label} style={hue != null ? { '--hue': hue } : undefined}>
        {promo.poster ? (
            <img src={promo.poster} alt="" loading="lazy" decoding="async" />
        ) : (
            <span className="prThumbArt" aria-hidden="true">
                <LuClapperboard />
            </span>
        )}
        <span className="prThumbShade" aria-hidden="true" />
        <span className="prThumbPlay" aria-hidden="true">
            <LuPlay />
        </span>
        {promo.ytId ? (
            <span className="prThumbTime isYoutube" aria-hidden="true">
                <SiYoutube />
            </span>
        ) : promo.seconds ? (
            <span className="prThumbTime" aria-hidden="true">
                {clipLength(promo.seconds)}
            </span>
        ) : null}
    </button>
);
