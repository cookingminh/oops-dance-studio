import { Link } from 'react-router-dom';
import { LuChevronRight, LuGraduationCap } from 'react-icons/lu';
import { classPhase } from '@/services/classes';
import { classImageUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import placeholder from '@/assets/images/logo-mark.webp';
import SectionCard from '../../../common/SectionCard';
import { classPath } from '../../class-hub/hubModel';
import { classColor } from '../../../common/session-modal/sessionModel';

// Class members now live on each class's page (Students tab): one link per class that hasn't ended.
const ClassMembersLinks = ({ classes, today }) => {
    const { t, tn } = useI18n();
    const current = classes.filter((cls) => classPhase(cls, today) !== 'ended');
    if (current.length === 0) return null;
    return (
        <SectionCard
            className="atMembersCard"
            icon={LuGraduationCap}
            title={t('Class members')}
            subtitle={t('Each class keeps its students on its own page: add, move or remove them there.')}
        >
            <ul className="atMembers">
                {current.map((cls) => (
                    <li key={cls.id}>
                        <Link to={classPath(cls.id, { tab: 'students' })} className="atMember" style={{ '--class': classColor(cls.id) }}>
                            <img src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
                            <span>
                                <strong>{cls.name}</strong>
                                <small>{tn(cls.students?.length ?? 0, '{count} student', '{count} students')}</small>
                            </span>
                            <LuChevronRight aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
};

export default ClassMembersLinks;
