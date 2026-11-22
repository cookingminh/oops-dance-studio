import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LuArrowUpRight, LuPlay } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { sections, videos } from '@/content/about';
import { youtubeEmbed } from '@/lib/youtube';
import { useI18n } from '@/i18n/i18nContext';
import VideoThumb from '@/ui/VideoThumb';
import { EASE_OUT, reveal, stagger, staggerItem, useLocalize } from './aboutHelpers';

const meta = (video, L) => [video.year, video.note && L(video.note)].filter(Boolean).join(' · ');

// The featured video first, then the rest in the file's order.
const startOrder = () => {
    const featured = videos.find((video) => video.featured) ?? videos[0];
    return [featured, ...videos.filter((video) => video !== featured)];
};

// Videos as a "lite" embed: YouTube thumbnails only, and nothing from YouTube loads until someone
// presses play. Then the big player swaps in the privacy-enhanced iframe. Playing a video from the
// grid swaps it with the one in the big player, so there is only ever one player on the page.
const AboutVideos = () => {
    const L = useLocalize();
    const { t } = useI18n();
    const reduce = useReducedMotion();
    const [order, setOrder] = useState(startOrder);
    const [playing, setPlaying] = useState(false);
    const stageRef = useRef(null);

    if (!order.length) return null;
    const [active, ...rest] = order;

    const playFromGrid = (slot) => {
        setOrder((current) => {
            const next = [...current];
            [next[0], next[slot + 1]] = [next[slot + 1], next[0]];
            return next;
        });
        setPlaying(true);
        // Bring the player into view when it's off screen (phones: it sits above the grid).
        const box = stageRef.current?.getBoundingClientRect();
        if (box && (box.top < 80 || box.bottom > window.innerHeight)) {
            stageRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }
    };

    return (
        <section className="abSection abVideos" aria-labelledby="videos-title">
            <div className="abWrap">
                <motion.div className="abVideosCard" {...reveal(reduce, { y: 40, duration: 0.7 })}>
                    <h2 id="videos-title" className="abTitle">
                        {L(sections.videos.title)}
                    </h2>

                    <div className="abStage" ref={stageRef}>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={`${active.id}-${playing}`}
                                className="abStageFrame"
                                initial={{ opacity: 0, scale: reduce ? 1 : 1.02 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3, ease: EASE_OUT }}
                            >
                                {playing ? (
                                    <iframe
                                        src={youtubeEmbed(active.youtubeId)}
                                        title={active.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        allowFullScreen
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="abStagePoster"
                                        onClick={() => setPlaying(true)}
                                        aria-label={t('Play video: {title}', { title: active.title })}
                                    >
                                        <VideoThumb id={active.youtubeId} size="max" />
                                        <span className="abPlay" aria-hidden="true">
                                            <LuPlay />
                                        </span>
                                    </button>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="abStageMeta">
                        <h3>{active.title}</h3>
                        <p>{meta(active, L)}</p>
                    </div>
                    <p className="sr-only" aria-live="polite">
                        {playing ? t('Now playing: {title}', { title: active.title }) : ''}
                    </p>

                    {rest.length > 0 && (
                        <motion.ul className="abVideoGrid" {...stagger(reduce, 0.07)}>
                            {rest.map((video, slot) => (
                                // Keyed by slot: a swap keeps keyboard focus where it was.
                                <motion.li key={slot} {...(reduce ? {} : staggerItem)}>
                                    <button
                                        type="button"
                                        className="abVideoCard"
                                        onClick={() => playFromGrid(slot)}
                                        aria-label={t('Play video: {title}', { title: video.title })}
                                    >
                                        <span className="abVideoThumb">
                                            <VideoThumb id={video.youtubeId} />
                                            <span className="abPlay isSmall" aria-hidden="true">
                                                <LuPlay />
                                            </span>
                                        </span>
                                        <span className="abVideoText">
                                            <strong>{video.title}</strong>
                                            <small>{meta(video, L)}</small>
                                        </span>
                                    </button>
                                </motion.li>
                            ))}
                        </motion.ul>
                    )}

                    <div className="abVideosMore">
                        <a className="abBtn isWhite" href={sections.videos.moreUrl} target="_blank" rel="noopener noreferrer">
                            <SiYoutube className="abYoutubeIcon" aria-hidden="true" />
                            {L(sections.videos.more)}
                            <LuArrowUpRight aria-hidden="true" />
                            <span className="sr-only"> {t('(opens in a new tab)')}</span>
                        </a>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default AboutVideos;
