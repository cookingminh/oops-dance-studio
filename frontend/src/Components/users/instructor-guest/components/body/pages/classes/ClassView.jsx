import { Link } from 'react-router-dom';
import { LuGift, LuMusic, LuTicket } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { ClassBanner, LessonCard, WeekStrip } from './ClassParts';
import { NextSessionCard } from './ClassNext';
import { StudentProgress } from './ClassProgress';
import { ClassRoster } from './ClassRoster';
import PromoCard from './PromoCard';
import ClassTuitionLine from '../tuition/ClassTuitionLine';

// Everything about one class on one screen: who/where, (students) tuition, the routine it is
// learning (sessions held, shoot day), the next session (instructors check in from here), the next
// routine's promo (instructors upload it, students watch it), the coming week and attendance (own,
// or the students'). onChanged() reloads the classes.
export const ClassView = ({ cls, today, now, isInstructor, onCheck, onChanged }) => (
    <div className={`pfClassView${isInstructor ? ' isInstructor' : ''}`}>
        <ClassBanner cls={cls} today={today} isInstructor={isInstructor} />
        {!isInstructor && <ClassTuitionLine classId={cls.id} />}
        <LessonCard cls={cls} today={today} isInstructor={isInstructor} />
        <NextSessionCard cls={cls} today={today} now={now} isInstructor={isInstructor} onCheck={onCheck} />
        <PromoCard cls={cls} isInstructor={isInstructor} onChanged={onChanged} />
        <WeekStrip cls={cls} today={today} now={now} />
        {isInstructor ? <ClassRoster cls={cls} today={today} /> : <StudentProgress cls={cls} />}
    </div>
);

// Nothing to show yet. Students get a nudge towards their free first class.
export const NoClasses = ({ isInstructor }) => {
    const { t } = useI18n();
    if (isInstructor) {
        return (
            <div className="pfEmpty">
                <span className="pfEmptyArt" aria-hidden="true">
                    <LuMusic />
                </span>
                <strong>{t('You are not teaching any class yet.')}</strong>
                <p>{t('Your classes, lessons and students will show up here once the studio assigns you a class.')}</p>
            </div>
        );
    }
    return (
        <div className="pfEmpty">
            <span className="pfEmptyArt" aria-hidden="true">
                <LuMusic />
            </span>
            <strong>{t('Ready for your first class?')}</strong>
            <p>{t('Pick a style you love and come dance with us. Your first class is on the house!')}</p>
            <div className="pfEmptyActions">
                <Link to="/classes" className="pfBtn isPrimary">
                    <LuGift aria-hidden="true" /> {t('Your first class is free')}
                </Link>
                <Link to="/rooms" className="pfBtn">
                    <LuTicket aria-hidden="true" /> {t('Book a room')}
                </Link>
            </div>
        </div>
    );
};
