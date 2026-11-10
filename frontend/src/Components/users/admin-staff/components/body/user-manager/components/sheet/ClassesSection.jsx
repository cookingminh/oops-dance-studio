import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuArrowRightLeft, LuArrowUpRight, LuPlus } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { classImageUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import placeholder from '@/assets/images/logo-mark.webp';
import { displayName, scheduleSummary } from '../../peopleModel';
import EnrolPicker from './EnrolPicker';
import SwitchClassInline from '../../../../common/switch-class/SwitchClassInline';

const reveal = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.25 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.18 } },
};

// Students and guests: the classes they take (with a quick "Enrol in a class" and "Switch" to
// move them to another class, which unfolds here: the panel is already a dialog).
// Instructors: the classes they teach, how many students each has and the pay rate.
const ClassesSection = ({ person, people, today, activity, startEnrolling, onChanged }) => {
    const { t, tn, formatDate, dayName } = useI18n();
    const [enrolling, setEnrolling] = useState(Boolean(startEnrolling));
    const [switchingId, setSwitchingId] = useState(null); // class they're moving out of
    const isLearner = person.role === 'guest';
    // A switch between courses: leaving after the paid course, or joining from a later one.
    const placeText = (joinedAt, leavesAfter) => {
        if (leavesAfter) return t('Leaves after {date}', { date: formatDate(leavesAfter, 'dayMonth') });
        if (joinedAt && today && joinedAt > today) return t('Joins {date}', { date: formatDate(joinedAt, 'dayMonth') });
        return joinedAt && t('Since {date}', { date: formatDate(joinedAt, 'dayMonth') });
    };
    const isTeacher = person.role === 'instructor' || person.teaches.length > 0;

    // Instructor names and class sizes come from the directory the page already has.
    const { nameById, sizeOf } = useMemo(() => {
        const names = new Map(people.map((p) => [p.id, displayName(p)]));
        const sizes = new Map();
        for (const p of people) for (const e of p.enrolments) sizes.set(e.class.id, (sizes.get(e.class.id) ?? 0) + 1);
        return { nameById: names, sizeOf: sizes };
    }, [people]);
    const allClasses = useMemo(() => {
        const map = new Map();
        for (const p of people) for (const cls of p.teaches) map.set(cls.id, cls);
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [people]);

    if (!isLearner && !isTeacher) return null;

    const pay = activity.data?.pay;
    const rateOf = (cls) => (pay?.classRates ? pay.classRates[cls.id] ?? pay.defaultRate : null);

    const classRow = (cls, detail, aside, more) => (
        <li key={cls.id} className="classLine">
            <img src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
            <span className="classLineText">
                <strong>{cls.name}</strong>
                <small>{detail}</small>
                {more && <small>{more}</small>}
            </span>
            {aside && <span className="classLineAside">{aside}</span>}
        </li>
    );

    if (isTeacher) {
        return (
            <section className="sheetSection" aria-labelledby="sheet-classes">
                <div className="sectionHead">
                    <h3 id="sheet-classes">
                        {t('Teaching')} <span className="segCount">{person.teaches.length}</span>
                    </h3>
                    <Link className="sectionLink" to="/admin/classes">
                        {t('Open Classes')} <LuArrowUpRight aria-hidden="true" />
                    </Link>
                </div>
                {person.teaches.length === 0 ? (
                    <p className="sectionEmpty">{t('No class to teach yet. Choose them as the instructor of a class on the Classes page.')}</p>
                ) : (
                    <ul className="classLines">
                        {person.teaches.map((cls) =>
                            classRow(
                                cls,
                                [tn(sizeOf.get(cls.id) ?? 0, '{count} student', '{count} students'), scheduleSummary(cls.schedules, dayName)].filter(Boolean).join(' · '),
                                rateOf(cls) !== null && t('{amount} / session', { amount: formatVnd(rateOf(cls)) })
                            )
                        )}
                    </ul>
                )}
            </section>
        );
    }

    const enrolledIds = new Set(person.enrolments.map((e) => e.class.id));
    const available = allClasses.filter((cls) => !enrolledIds.has(cls.id));
    const switchingFrom = person.enrolments.find((e) => e.class.id === switchingId)?.class;
    const openSwitch = (classId) => {
        setEnrolling(false);
        setSwitchingId(classId);
    };

    return (
        <section className="sheetSection" aria-labelledby="sheet-classes">
            <div className="sectionHead">
                <h3 id="sheet-classes">
                    {t('Classes')} <span className="segCount">{person.enrolments.length}</span>
                </h3>
                <Link className="sectionLink" to="/admin/classes">
                    {t('Open Classes')} <LuArrowUpRight aria-hidden="true" />
                </Link>
            </div>
            {person.enrolments.length === 0 ? (
                <p className="sectionEmpty">{t('Not in a class yet. They show up as a Student once they join one.')}</p>
            ) : (
                <ul className="classLines">
                    {person.enrolments.map(({ class: cls, joined_at: joinedAt, leaves_after: leavesAfter }) =>
                        classRow(
                            cls,
                            [nameById.get(cls.instructor_id), scheduleSummary(cls.schedules, dayName)].filter(Boolean).join(' · '),
                            available.length > 0 && (
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color={switchingId === cls.id ? 'danger' : 'default'}
                                    className="classSwitch"
                                    startContent={<LuArrowRightLeft aria-hidden="true" />}
                                    aria-label={t('Switch {name} from {className}', { name: person.name, className: cls.name })}
                                    aria-expanded={switchingId === cls.id}
                                    onPress={() => openSwitch(switchingId === cls.id ? null : cls.id)}
                                >
                                    {t('Switch')}
                                </Button>
                            ),
                            placeText(joinedAt, leavesAfter)
                        )
                    )}
                </ul>
            )}
            <AnimatePresence initial={false}>
                {switchingFrom && (
                    <motion.div key={`switch-${switchingFrom.id}`} className="revealBox" {...reveal}>
                        <SwitchClassInline
                            student={person}
                            fromClass={switchingFrom}
                            onCancel={() => setSwitchingId(null)}
                            onSwitched={() => {
                                setSwitchingId(null);
                                onChanged();
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
                {switchingFrom ? null : enrolling ? (
                    <motion.div key="picker" className="revealBox" {...reveal}>
                        <EnrolPicker
                            person={person}
                            classes={available}
                            nameById={nameById}
                            onCancel={() => setEnrolling(false)}
                            onEnrolled={() => {
                                setEnrolling(false);
                                onChanged();
                            }}
                        />
                    </motion.div>
                ) : (
                    available.length > 0 && (
                        <motion.div key="add" {...reveal}>
                            <Button size="sm" variant="flat" className="sectionAdd" startContent={<LuPlus aria-hidden="true" />} onPress={() => setEnrolling(true)}>
                                {t('Enrol in a class')}
                            </Button>
                        </motion.div>
                    )
                )}
            </AnimatePresence>
        </section>
    );
};

export default ClassesSection;
