import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuArrowRight, LuGraduationCap, LuHistory } from 'react-icons/lu';
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
import PastClasses from './PastClasses';
import JoinRequests, { NoClassesYet } from './JoinRequests';
import { loadMyJoinRequests } from './joinRequestsData';

// /profile/my-classes for both roles: pick a class from the tabs and everything about it opens
// below. The choice lives in the URL (?class=), so the overview can link straight to a class.
// Students also get "Classes you've taken": every course so far with its tuition (PastClasses), and above the
// classes their requests to join one (JoinRequests: waiting, or answered lately).
const MyClasses = () => {
    const { user, role } = useAuth();
    const { t, tn } = useI18n();
    const isInstructor = role === ROLES.instructor;
    const data = useAsync(() => (isInstructor ? loadInstructorClasses(user.id) : loadStudentClasses(user.id)), [user.id, isInstructor]);
    // Requests are newer than the page: without them, My classes still works.
    const requests = useAsync(() => (isInstructor ? Promise.resolve(null) : loadMyJoinRequests().catch(() => null)), [user.id, isInstructor]);
    const [params, setParams] = useSearchParams();
    const { now } = useStudioNow();
    const [checking, setChecking] = useState(null); // { kind, attendance }
    const [showPast, setShowPast] = useState(false);
    // Bumped after a course is paid from "Classes you've taken": the class view reads its tuition line again.
    const [paidCount, setPaidCount] = useState(0);

    const classes = data.data?.classes ?? [];
    const today = data.data?.today;
    const wanted = Number(params.get('class'));
    // Without a choice in the URL, open the class that meets soonest.
    const soonest = today ? upcomingSessions(classes, today, now, 8)[0]?.cls.id : undefined;
    const selectedId = classes.some((cls) => cls.id === wanted) ? wanted : (soonest ?? classes[0]?.id);
    const select = (id) => setParams({ class: String(id) }, { replace: true });
    const asked = requests.data?.requests ?? [];
    // An approved request opens its class in the tabs below.
    const openClass = (id) => {
        select(id);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('my-classes-card')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };

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
            {data.data && asked.length > 0 && (
                <JoinRequests
                    requests={asked}
                    today={requests.data.today}
                    classIds={new Set(classes.map((cls) => cls.id))}
                    onChanged={requests.reload}
                    onOpenClass={openClass}
                />
            )}
            <SectionCard
                id="my-classes-card"
                className="pfClassesCard"
                icon={LuGraduationCap}
                title={t('Your Classes')}
                subtitle={subtitle}
                actions={
                    !isInstructor && (
                        <>
                            <button type="button" className="cardLink pcOpen" onClick={() => setShowPast(true)} aria-haspopup="dialog" aria-label={t('Classes you’ve taken')}>
                                <LuHistory aria-hidden="true" />
                                <span className="pcOpenLabel">{t('Classes you’ve taken')}</span>
                            </button>
                            <Link to="/classes" className="cardLink">
                                {t('Explore other classes')} <LuArrowRight aria-hidden="true" />
                            </Link>
                        </>
                    )
                }
            >
                <AsyncState state={data} isEmpty={false}>
                    {classes.length === 0 && isInstructor && <NoClasses isInstructor />}
                    {classes.length === 0 && !isInstructor && <NoClassesYet waiting={asked.some((row) => row.status === 'pending')} />}
                    {classes.length > 0 && (
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
                                {(cls) => <ClassView key={paidCount} cls={cls} today={today} now={now} isInstructor={isInstructor} onCheck={setChecking} />}
                            </ClassPanel>
                        </>
                    )}
                </AsyncState>
            </SectionCard>

            {showPast && <PastClasses onClose={() => setShowPast(false)} onPaid={() => setPaidCount((count) => count + 1)} />}

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
