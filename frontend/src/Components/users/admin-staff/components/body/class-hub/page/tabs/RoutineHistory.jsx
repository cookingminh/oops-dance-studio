import { LuMusic } from 'react-icons/lu';
import { youtubeId, youtubeWatch } from '@/lib/youtube';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../common/SectionCard';

// Read-only list of an ended class's routines with their class videos.
const RoutineHistory = ({ cls, progress }) => {
    const { t, formatDate } = useI18n();
    const lessons = new Map((cls.lessons ?? []).map((lesson) => [lesson.id, lesson]));
    return (
        <SectionCard icon={LuMusic} title={t('Routines')} subtitle={t('What the class learned, with its videos')}>
            {progress.length === 0 ? (
                <p className="hubHint">{t('No routines were recorded.')}</p>
            ) : (
                <ul className="hubHistory">
                    {[...progress].sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map((item) => {
                        const video = youtubeId(lessons.get(item.lesson_id)?.video_url);
                        return (
                            <li key={item.lesson_id}>
                                <span className="hubHistoryDate">{formatDate(item.starts_on, 'dayMonth')}</span>
                                <strong>{item.title}</strong>
                                <span className="hubHint">{t('{held} of {total} sessions', { held: item.sessions_held, total: item.session_count })}</span>
                                {video ? (
                                    <a href={youtubeWatch(video)} target="_blank" rel="noreferrer" className="hubLink">
                                        {t('Watch the video')}
                                    </a>
                                ) : (
                                    <span className="hubHint">{t('No video')}</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
};

export default RoutineHistory;
