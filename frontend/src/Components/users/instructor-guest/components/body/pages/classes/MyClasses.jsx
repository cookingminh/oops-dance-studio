import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuArrowRight, LuGraduationCap } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { upcomingSessions, useStudioNow } from '../../profileHelpers';
import CheckForm from '../check-in/CheckForm';
import { loadInstructorClasses, loadStudentClasses } from './classData';
import { ClassPanel, ClassTabs } from './ClassSwitcher';
import { ClassView, NoClasses } from './ClassView';
import { NextLine } from './ClassParts';

// /profile/my-classes for both roles: pick a class from the tabs and everything about it opens
// below. The choice lives in the URL (?class=), so the overview can link straight to a class.
const MyClasses = () => {
    const { user, role } = useAuth();
    const { t, tn } = useI18n();
    const isInstructor = role === ROLES.instructor;
    const data = useAsync(() => (isInstructor ? loadInstructorClasses(user.id) : loadStudentClasses(user.id)), [user.id, isInstructor]);
    const [params, setParams] = useSearchParams();
    const { now } = useStudioNow();
    const [checking, setChecking] = useState(null); // { kind, attendance }

    const classes = data.data?.classes ?? [];
    const today = data.data?.today;
    const wanted = Number(params.get('class'));
    // Without a choice in the URL, open the class that meets soonest.
    const soonest = today ? upcomingSessions(classes, today, now, 8)[0]?.cls.id : undefined;
    const selectedId = classes.some((cls) => cls.id === wanted) ? wanted : (soonest ?? classes[0]?.id);
    const select = (id) => setParams({ class: String(id) }, { replace: true });

    let subtitle = t('Loading…');
    if (data.data) {
        subtitle = isInstructor
            ? tn(classes.length, '{count} class · {students} students', '{count} classes · {students} students', {
                students: classes.reduce((sum, cls) => sum + cls.students.length, 0),
            })
            : tn(classes.length, 'You dance in {count} class', 'You dance in {count} classes');
    }

    return (
        <>
            <SectionCard
                className="pfClassesCard"
                icon={LuGraduationCap}
                title={t('Your Classes')}
                subtitle={subtitle}
                actions={
                    !isInstructor && (
                        <Link to="/classes" className="cardLink">
                            {t('Explore other classes')} <LuArrowRight aria-hidden="true" />
                        </Link>
                    )
                }
            >
                <AsyncState state={data} isEmpty={false}>
                    {classes.length === 0 ? (
                        <NoClasses isInstructor={isInstructor} />
                    ) : (
                        <>
                            <ClassTabs
                                classes={classes}
                                selectedId={selectedId}
                                onSelect={select}
                                idPrefix="my-classes"
                                itemClassName="singleItem"
                                renderMeta={(cls) => <NextLine cls={cls} today={today} now={now} />}
                            />
                            <ClassPanel classes={classes} selectedId={selectedId} idPrefix="my-classes">
                                {(cls) => <ClassView cls={cls} today={today} now={now} isInstructor={isInstructor} onCheck={setChecking} onChanged={data.reload} />}
                            </ClassPanel>
                        </>
                    )}
                </AsyncState>
            </SectionCard>

            {checking && (
                <CheckForm
                    kind={checking.kind}
                    attendance={checking.attendance}
                    onClose={() => setChecking(null)}
                    onDone={() => {
                        setChecking(null);
                        data.reload();
                    }}
                />
            )}
        </>
    );
};

export default MyClasses;
