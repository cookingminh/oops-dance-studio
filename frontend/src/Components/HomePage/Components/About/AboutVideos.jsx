import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LuArrowUpRight, LuPlay } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { sections, videos } from '@/content/about';
import { useAsync } from '@/hooks/useAsync';
import { youtubeEmbed } from '@/lib/youtube';
import { listChannelVideos } from '@/services/youtubeFeed';
import { useI18n } from '@/i18n/i18nContext';
import VideoThumb from '@/ui/VideoThumb';
import { EASE_OUT, reveal, stagger, staggerItem, useLocalize } from './aboutHelpers';

const LATEST = sections.videos.latest;
const LATEST_COUNT = Math.max(0, LATEST?.count ?? 0);

// The picks from the content file, the featured one first.
const PICKS = (() => {
    const featured = videos.find((video) => video.featured) ?? videos[0];
    return featured ? [featured, ...videos.filter((video) => video !== featured)] : [];
})();
const PICK_IDS = new Set(PICKS.map((video) => video.youtubeId));

const loadLatest = () => (LATEST_COUNT ? listChannelVideos(LATEST.channelId) : Promise.resolve([]));

const VideoRow = ({ className, title, list, meta, onPlay, reduce, t }) => (
    <div className={`abVideoRow ${className}`}>
        {title && <h3 className="abVideoRowTitle">{title}</h3>}
        <motion.ul className="abVideoGrid" {...stagger(reduce, 0.07)}>
            {list.map((video, slot) => (
                // Keyed by slot: playing a video keeps keyboard focus where it was.
                <motion.li key={slot} {...(reduce ? {} : staggerItem)}>
                    <button type="button" className="abVideoCard" onClick={() => onPlay(video)} aria-label={t('Play video: {title}', { title: video.title })}>
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
    </div>
);

// Grey cards in the shape of the real ones while the channel's newest videos load.
const LoadingRow = ({ title, count }) => (
    <div className="abVideoRow isLoading" aria-busy="true">
        <h3 className="abVideoRowTitle">{title}</h3>
        <ul className="abVideoGrid" aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
                <li key={index} className="abVideoSkeleton">
                    <span />
                    <i />
                    <i />
                </li>
            ))}
        </ul>
    </div>
);

// Videos as a "lite" embed: YouTube thumbnails only, and nothing from YouTube's player loads until
// someone presses play. Then the big player swaps in the privacy-enhanced iframe. Any video from the
// rows below plays in that one player (it leaves its row while it's there).
// Two rows: the picks from the content file, and the channel's newest videos, read from its feed when
// the page opens (the row stays away if the feed can't be read).
const AboutVideos = () => {
    const L = useLocalize();
    const { t, intl } = useI18n();
    const reduce = useReducedMotion();
    const feed = useAsync(loadLatest, []);
    const [activeId, setActiveId] = useState(PICKS[0]?.youtubeId);
    const [playing, setPlaying] = useState(false);
    const stageRef = useRef(null);

    // One more than the row shows, so it stays full while one of them is in the big player.
    const latest = useMemo(
        () => (feed.data ?? []).filter((video) => !PICK_IDS.has(video.youtubeId)).slice(0, LATEST_COUNT + 1),
        [feed.data],
    );

    if (!PICKS.length) return null;
    const active = [...PICKS, ...latest].find((video) => video.youtubeId === activeId) ?? PICKS[0];
    const picksRow = PICKS.filter((video) => video.youtubeId !== active.youtubeId).slice(0, PICKS.length - 1);
    const latestRow = latest.filter((video) => video.youtubeId !== active.youtubeId).slice(0, LATEST_COUNT);
    const loadingLatest = LATEST_COUNT > 0 && feed.loading && !feed.data;
    const twoRows = latestRow.length > 0 || loadingLatest;

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
        // Bring the player into view when it's off screen (it sits above the rows).
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
                        <p>{meta(active)}</p>
                    </div>
                    <p className="sr-only" aria-live="polite">
                        {playing ? t('Now playing: {title}', { title: active.title }) : ''}
                    </p>

                    {picksRow.length > 0 && (
                        <VideoRow
                            className="isPicks"
                            title={twoRows ? L(sections.videos.picks) : null}
                            list={picksRow}
                            meta={meta}
                            onPlay={play}
                            reduce={reduce}
                            t={t}
                        />
                    )}
                    {loadingLatest && <LoadingRow title={L(LATEST.title)} count={LATEST_COUNT} />}
                    {latestRow.length > 0 && (
                        <VideoRow className="isLatest" title={L(LATEST.title)} list={latestRow} meta={meta} onPlay={play} reduce={reduce} t={t} />
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
