import { useId } from 'react';
import { motion } from 'framer-motion';
import { LuAlertTriangle, LuCheck, LuClock, LuMusic, LuUser, LuUsers } from 'react-icons/lu';
import { classImageUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import placeholder from '@/assets/images/logo-mark.webp';
import { fadeUp, stagger } from '../motion';
import { displayName, priceDelta, targetCourse, weeklyTimes } from './switchModel';

// One class as a radio card: name, course price (and how it compares), the course they'd join,
// instructor, weekly times and how many students it has. A real radio input, so arrow keys move
// between the cards. `join` = targetCourse() (null: no course to join yet).
const ClassCard = ({ cls, fromPrice, join, picked, onPick, group }) => {
    const { t, tn, dayName, formatDate } = useI18n();
    const id = useId();
    const delta = priceDelta(cls.price, fromPrice, formatVnd);
    const times = weeklyTimes(cls.schedules, dayName);
    const teacher = displayName(cls.instructor);

    return (
        <motion.label variants={fadeUp} className={`swCard${picked ? ' isPicked' : ''}`}>
            <input
                type="radio"
                name={group}
                value={cls.id}
                checked={picked}
                onChange={() => onPick(cls.id)}
                aria-labelledby={`${id}-name`}
                aria-describedby={`${id}-facts`}
            />
            <img src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
            <span className="swCardText">
                <strong id={`${id}-name`}>{cls.name}</strong>
                <span id={`${id}-facts`} className="swCardFacts">
                    <span className="swCardPrice">
                        {t('{amount} / course', { amount: formatVnd(cls.price) })}
                        {delta ? (
                            <span className={`swDelta ${delta.up ? 'isUp' : 'isDown'}`}>{delta.text}</span>
                        ) : (
                            <span className="swDelta">{t('Same price')}</span>
                        )}
                    </span>
                    {join ? (
                        <span className="swCardNext">
                            <LuMusic aria-hidden="true" />
                            {join.late
                                ? t('Joins {course} (running now)', { course: join.course.title })
                                : t('Joins from {course} · {date}', { course: join.course.title, date: formatDate(join.course.starts_on, 'short') })}
                        </span>
                    ) : (
                        <span className="swCardNext isMissing">
                            <LuAlertTriangle aria-hidden="true" />
                            {t('No upcoming course yet')}
                        </span>
                    )}
                    <span>
                        <LuUser aria-hidden="true" /> {teacher || t('No instructor')}
                    </span>
                    <span>
                        <LuClock aria-hidden="true" /> {times || t('No schedule yet')}
                    </span>
                    <span>
                        <LuUsers aria-hidden="true" /> {tn(cls.memberCount, '{count} student', '{count} students')}
                    </span>
                </span>
            </span>
            <span className="swCardCheck" aria-hidden="true">
                <LuCheck />
            </span>
        </motion.label>
    );
};

// "Join another class": every class the student isn't in yet, with the course they'd join.
const ClassChoice = ({ classes, fromPrice, value, onChange, progress, today, fromRunning }) => {
    const { t } = useI18n();
    const group = useId();
    // Classes they can join now first; the ones without a course to join after them.
    const options = classes
        .map((cls) => ({ cls, join: targetCourse(cls, { progress, today, fromRunning }) }))
        .sort((a, b) => Number(!a.join) - Number(!b.join));
    return (
        <fieldset className="swStep">
            <legend className="swStepLabel">
                <span className="swStepNo" aria-hidden="true">
                    1
                </span>
                {t('Join another class')}
            </legend>
            <motion.div className="swCards" variants={stagger} initial="hidden" animate="show">
                {options.map(({ cls, join }) => (
                    <ClassCard
                        key={cls.id}
                        cls={cls}
                        fromPrice={fromPrice}
                        join={join}
                        picked={value === cls.id}
                        onPick={onChange}
                        group={group}
                    />
                ))}
            </motion.div>
        </fieldset>
    );
};

export default ClassChoice;
