import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LuArrowUpRight, LuPlay } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { fallbackVideos, sections } from '@/content/about';
import { useAsync } from '@/hooks/useAsync';
import { youtubeEmbed } from '@/lib/youtube';
import { listChannelVideos } from '@/services/youtubeFeed';
import { useI18n } from '@/i18n/i18nContext';
import VideoThumb from '@/ui/VideoThumb';
import { EASE_OUT, reveal, stagger, staggerItem, useLocalize } from './aboutHelpers';

const COPY = sections.videos;
const COUNT = Math.max(0, COPY.count ?? 4);
const loadNewest = () => listChannelVideos(COPY.channelId);

// Grey shapes of the player and the list while the channel's videos load.
const Loading = () => (
    <div className="abVideosBody" aria-busy="true">
        <div aria-hidden="true">
            <div className="abStage abSkeleton" />
            <div className="abStageMeta">
                <i className="abSkeleton abSkeletonLine" />
            </div>
        </div>
        <ul className="abVideoRow" aria-hidden="true">
            {Array.from({ length: COUNT }, (_, index) => (
                <li key={index} className="abVideoSkeleton">
                    <span className="abSkeleton" />
                    <div>
                        <i className="abSkeleton" />
                        <i className="abSkeleton" />
                    </div>
                </li>
            ))}
        </ul>
    </div>
);

// The crew's newest videos, straight from its YouTube channel: the newest one in the big player, the
// next ones listed beside it (under it on phones). A "lite" embed: thumbnails only, and nothing from
// YouTube's player loads until someone presses play; then the big player swaps in the privacy-enhanced
// iframe. A video from the list plays in that one player (and leaves the list while it's there). If
// the channel can't be read, fallbackVideos from the content file stand in.
const AboutVideos = () => {
    const L = useLocalize();
    const { t, intl } = useI18n();
    const reduce = useReducedMotion();
    const feed = useAsync(loadNewest, []);
    const [activeId, setActiveId] = useState(null);
    const [playing, setPlaying] = useState(false);
    const stageRef = useRef(null);

    const loading = feed.loading && !feed.data;
    const fromChannel = (feed.data ?? []).slice(0, COUNT + 1);
    const list = fromChannel.length ? fromChannel : fallbackVideos.slice(0, COUNT + 1);
    if (!loading && !list.length) return null;

    const active = list.find((video) => video.youtubeId === activeId) ?? list[0];
    const rest = list.filter((video) => video !== active).slice(0, COUNT);
    const isNewest = fromChannel.length > 0 && active === fromChannel[0];

    const dateFormat = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', year: 'numeric' });
    const meta = (video) => {
        if (video.published) {
            const date = new Date(video.published);
            return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
        }
        return [video.year, video.note && L(video.note)].filter(Boolean).join(' · ');
    };

    const play = (video) => {
        setActiveId(video.youtubeId);
        setPlaying(true);
        // Bring the player into view when it's off screen (phones: it sits above the list).
        const box = stageRef.current?.getBoundingClientRect();
        if (box && (box.top < 80 || box.bottom > window.innerHeight)) {
            stageRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }
    };

    return (
        <section className="abSection abVideos" aria-labelledby="videos-title">
            <div className="abWrap">
                <motion.div className="abVideosCard" {...reveal(reduce, { y: 40, duration: 0.7 })}>
                    <div className="abVideosHead">
                        <h2 id="videos-title" className="abTitle">
                            {L(COPY.title)}
                        </h2>
                        <a className="abBtn isWhite" href={COPY.moreUrl} target="_blank" rel="noopener noreferrer">
                            <SiYoutube className="abYoutubeIcon" aria-hidden="true" />
                            {L(COPY.more)}
                            <LuArrowUpRight aria-hidden="true" />
                            <span className="sr-only"> {t('(opens in a new tab)')}</span>
                        </a>
                    </div>

                    {loading ? (
                        <Loading />
                    ) : (
                        <div className="abVideosBody">
                            <div>
                                <div className="abStage" ref={stageRef}>
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={`${active.youtubeId}-${playing}`}
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
                                    <p>
                                        {isNewest && <span className="abNewest">{L(COPY.newest)}</span>}
                                        {meta(active)}
                                    </p>
                                </div>
                                <p className="sr-only" aria-live="polite">
                                    {playing ? t('Now playing: {title}', { title: active.title }) : ''}
                                </p>
                            </div>

                            {rest.length > 0 && (
                                <motion.ul className="abVideoRow" {...stagger(reduce, 0.07)}>
                                    {rest.map((video, slot) => (
                                        // Keyed by slot: playing a video keeps keyboard focus where it was.
                                        <motion.li key={slot} {...(reduce ? {} : staggerItem)}>
                                            <button
                                                type="button"
                                                className="abVideoCard"
                                                onClick={() => play(video)}
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
                                                    <small>{meta(video)}</small>
                                                </span>
                                            </button>
                                        </motion.li>
                                    ))}
                                </motion.ul>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </section>
    );
};

export default AboutVideos;
