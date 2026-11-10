import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { LuArrowUpRight, LuClapperboard, LuMusic, LuPlay } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { useAsync } from '@/hooks/useAsync';
import { listLatestClassVideos } from '@/services/classes';
import { avatarUrl } from '@/services/storage';
import { youtubeEmbed, youtubeId, youtubeWatch } from '@/lib/youtube';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { SOCIALS } from '../../NavBar/contactInfo';
import VideoThumb from '@/ui/VideoThumb';
import './ClassVideos.scss';

const EASE = [0.22, 1, 0.36, 1];

// /classes: the newest month's end-of-month class videos (class_lessons.video_url) as a small
// cinema — one big player and a playlist. Nothing loads from YouTube until someone presses play.
const ClassVideos = ({ classes }) => {
    const { t, monthName } = useI18n();
    const videos = useAsync(listLatestClassVideos, []);
    const [activeId, setActiveId] = useState(null);
    const [playing, setPlaying] = useState(false);

    // Videos in the same order as the classes, each with its class (name, coach) attached.
    const list = useMemo(() => {
        if (!classes.data || !videos.data) return undefined;
        const order = new Map(classes.data.map((cls, index) => [cls.id, index]));
        return videos.data
            .map((video) => ({ ...video, ytId: youtubeId(video.video_url), cls: classes.data[order.get(video.class_id)] }))
            .filter((video) => video.ytId && video.cls)
            .sort((a, b) => order.get(a.class_id) - order.get(b.class_id));
    }, [classes.data, videos.data]);

    const state = { data: list, error: videos.error ?? classes.error, loading: list === undefined, reload: videos.reload };
    const active = list?.find((video) => video.id === activeId) ?? list?.[0];
    const month = list?.[0]?.month;

    const pick = (video) => {
        setActiveId(video.id);
        setPlaying(true);
    };

    return (
        <section id="class-videos" className="hpVideos">
            <div className="hpVideosCard">
                <header className="hpSectionHead isDark" data-aos="fade-up">
                    <div>
                        <span className="hpEyebrow">{t('Class videos')}</span>
                        <h2>{month ? t('{month}, on camera', { month: monthName(month, { withYear: true }) }) : t('Every class, on camera')}</h2>
                        <p>{t('At the end of every month each class films the routine it learned, with real students, studio lights and a proper camera crew.')}</p>
                    </div>
                    <a className="hpYoutubeBtn" href={SOCIALS.youtube} target="_blank" rel="noreferrer">
                        <SiYoutube aria-hidden="true" />
                        <span>{t('Explore more on YouTube')}</span>
                        <LuArrowUpRight aria-hidden="true" />
                    </a>
                </header>

                <AsyncState state={state} emptyText="This month’s class videos are coming soon. Meanwhile, catch up on our YouTube channel.">
                    {() => (
                        <div className="hpVideoStage" data-aos="fade-up">
                            <div className="hpVideoMain">
                                <div className="hpVideoPlayer">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={`${active.id}-${playing}`}
                                            className="hpVideoFrame"
                                            initial={{ opacity: 0, scale: 1.015 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.28, ease: EASE }}
                                        >
                                            {playing ? (
                                                <iframe
                                                    src={youtubeEmbed(active.ytId)}
                                                    title={`${active.cls.name} — ${active.title}`}
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                    allowFullScreen
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="hpVideoPoster"
                                                    onClick={() => setPlaying(true)}
                                                    aria-label={t('Play the {name} video', { name: active.cls.name })}
                                                >
                                                    <VideoThumb id={active.ytId} size="max" />
                                                    <span className="hpVideoShade" aria-hidden="true" />
                                                    <span className="hpVideoTag">
                                                        <LuClapperboard aria-hidden="true" />
                                                        {t('Shoot day · {month}', { month: monthName(active.month) })}
                                                    </span>
                                                    <span className="hpPlayBtn" aria-hidden="true">
                                                        <LuPlay />
                                                    </span>
                                                </button>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                <div className="hpVideoMeta">
                                    <div className="hpVideoMetaText">
                                        <strong>{active.cls.name}</strong>
                                        <span>
                                            <LuMusic aria-hidden="true" /> {active.title}
                                        </span>
                                    </div>
                                    <div className="hpVideoCoach">
                                        {active.cls.instructor_avatar_path && <img src={avatarUrl(active.cls.instructor_avatar_path)} alt="" />}
                                        <span>
                                            {t('with')} <strong>{active.cls.instructor_name}</strong>
                                        </span>
                                    </div>
                                    <a className="hpVideoOpen" href={youtubeWatch(active.ytId)} target="_blank" rel="noreferrer">
                                        {t('Open on YouTube')} <LuArrowUpRight aria-hidden="true" />
                                    </a>
                                </div>
                            </div>

                            <div className="hpVideoListWrap">
                                <p className="hpVideoListHead">{t('{count} classes filmed', { count: list.length })}</p>
                                <LayoutGroup id="class-videos">
                                    <ul className="hpVideoList">
                                        {list.map((video) => {
                                            const isActive = video.id === active.id;
                                            return (
                                                <li key={video.id}>
                                                    <button
                                                        type="button"
                                                        className={`hpVideoItem${isActive ? ' isActive' : ''}`}
                                                        aria-pressed={isActive}
                                                        aria-label={t('Play the {name} video', { name: video.cls.name })}
                                                        onClick={() => pick(video)}
                                                    >
                                                        {isActive && (
                                                            <motion.span layoutId="hpVideoActive" className="hpVideoItemBg" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />
                                                        )}
                                                        <span className="hpVideoItemThumb">
                                                            <VideoThumb id={video.ytId} />
                                                            {isActive && playing ? (
                                                                <span className="hpEq" aria-hidden="true">
                                                                    <i />
                                                                    <i />
                                                                    <i />
                                                                </span>
                                                            ) : (
                                                                <LuPlay className="hpVideoItemPlay" aria-hidden="true" />
                                                            )}
                                                        </span>
                                                        <span className="hpVideoItemText">
                                                            <strong>{video.cls.name}</strong>
                                                            <small>{video.title}</small>
                                                            <em>{isActive && playing ? t('Now playing') : video.cls.instructor_name}</em>
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </LayoutGroup>
                            </div>
                        </div>
                    )}
                </AsyncState>
            </div>
        </section>
    );
};

export default ClassVideos;
