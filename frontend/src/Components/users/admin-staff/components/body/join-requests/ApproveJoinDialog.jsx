import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@nextui-org/react';
import { LuAlertTriangle, LuCheck } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listLessonProgress } from '@/services/classes';
import { approveJoinRequest } from '@/services/classJoinStaff';
import { listClassSeats } from '@/services/classJoin';
import { getTuitionSettings } from '@/services/tuition';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { classPath, routineNow } from '../class-hub/hubModel';
import { START_ASKED, START_LABELS, personName } from './joinModel';

// Approve a request: where the student starts, as "Add a student" (class-hub/page/EnrolDialog.jsx) offers it — the
// running course (in full by default, only the sessions left when Tuition → Settings pro-rates late joins) or the next
// one (paid in full) — preselected on what they asked for.
// With one way only, a line says what happens. class_join_approve adds them; the class's triggers bill the course and
// put them on the roll call. A class at its maximum takes nobody new: the dialog says so and can't approve until the
// maximum goes up (the class's Setup). onDone() after it worked.
const ApproveJoinDialog = ({ request, onClose, onDone }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    // The class's courses, and when the next course's renewal opens (its invoices go out then: someone joining after
    // that is billed for it too, private.bill_class).
    const progress = useAsync(
        () =>
            Promise.all([listLessonProgress([request.class_id]), getTuitionSettings().catch(() => null), listClassSeats().catch(() => new Map())]).then(
                ([rows, settings, seats]) => ({ rows, settings, seats: seats.get(request.class_id) ?? null })
            ),
        [request.class_id]
    );
    const [picked, setPicked] = useState(null); // null = what the student asked for
    const [saving, setSaving] = useState(false);
    const name = personName(request.student);
    const className = request.class?.name ?? '';
    const { current, planned } = routineNow(progress.data?.rows ?? []);
    const choices = Boolean(current && planned);
    const from = choices ? picked ?? request.start_pref : 'now';
    const left = current ? current.session_count - current.sessions_held : 0;
    const renewalOpen = Number(progress.data?.settings?.renewal_open_sessions);
    // Joining after sessions were held pays the whole course unless the studio pro-rates late joins (off by default;
    // settings that failed to load count as the default).
    const fullFee = Boolean(current) && current.sessions_held > 0 && left < current.session_count && !progress.data?.settings?.prorate_late_join;
    const fullFeeVars = current ? { title: current.title, left, count: current.session_count } : null;
    // Starting now near the end of a course: the next one's invoices are already out, so they get both.
    const bothCourses = choices && Number.isFinite(renewalOpen) && left <= renewalOpen;

    const submit = async () => {
        setSaving(true);
        try {
            const row = await approveJoinRequest(request.id, from);
            const later = from === 'next' && row?.joined_at;
            toast.success(
                later
                    ? t('{name} joins {class} on {date}. Their invoice is ready in Tuition.', { name, class: className, date: formatDate(row.joined_at, 'dayMonth') })
                    : bothCourses && from === 'now'
                      ? t('{name} is in {class}. Their invoices are ready in Tuition.', { name, class: className })
                      : current || planned
                        ? t('{name} is in {class}. Their invoice is ready in Tuition.', { name, class: className })
                        : t('{name} is in {class}.', { name, class: className })
            );
            onDone(row);
        } catch (error) {
            toast.error(error);
            setSaving(false);
        }
    };

    const options = choices
        ? [
            {
                key: 'now',
                title: t(START_LABELS.now),
                detail: fullFee
                    ? bothCourses
                        ? t('“{title}”: pays the full course ({left} of {count} sessions left), and the next course “{next}”, whose invoices are already out.', { ...fullFeeVars, next: planned.title })
                        : t('“{title}”: pays the full course ({left} of {count} sessions left).', fullFeeVars)
                    : bothCourses
                      ? t('“{title}”: pays for the {count} sessions left, and for the next course “{next}”, whose invoices are already out.', { title: current.title, count: left, next: planned.title })
                      : t('“{title}”: pays for the {count} sessions left.', { title: current.title, count: left }),
            },
            { key: 'next', title: t(START_LABELS.next), detail: t('“{title}”, starting {date}: pays the full course.', { title: planned.title, date: formatDate(planned.starts_on, 'dayMonth') }) },
        ]
        : [];

    let hint = null;
    if (!choices && current && fullFee) hint = t('They join “{title}” now and pay the full course ({left} of {count} sessions left).', fullFeeVars);
    else if (!choices && current) hint = t('They join “{title}” now and pay for the {count} sessions left.', { title: current.title, count: left });
    else if (!choices && planned) hint = t('They are billed for “{title}”, starting {date}.', { title: planned.title, date: formatDate(planned.starts_on, 'dayMonth') });
    else if (!choices) hint = t('This class has no course yet: they are billed when its first routine is planned.');
    // They asked for the next course and none is planned: approving starts them now.
    const noNext = !choices && current && request.start_pref === 'next';
    const seats = progress.data?.seats ?? null;

    return (
        <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'hubDialog jrDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="jrDialogHead">
                    <span className="jrDialogKicker">{t('Approve the request')}</span>
                    <span>{t('Add {name} to {class}', { name, class: className })}</span>
                </ModalHeader>
                <ModalBody className="jrDialogBody">
                    <div className="jrDialogWho">
                        <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(request.student?.avatar_path, request.student?.updated_at) ?? undefined} name={name} />
                        <span>
                            <strong>{name}</strong>
                            <small>{t(START_ASKED[request.start_pref] ?? START_ASKED.now)}</small>
                        </span>
                    </div>
                    {request.note && <blockquote className="jrQuote">“{request.note}”</blockquote>}
                    {seats?.full && (
                        <p className="jrWarn" role="alert">
                            <LuAlertTriangle aria-hidden="true" />
                            <span>
                                {t('The class is full ({taken} of {max} places). Raise its maximum to approve.', seats)}{' '}
                                <Link to={classPath(request.class_id, { tab: 'setup' })} onClick={onClose}>
                                    {t('Open its setup')}
                                </Link>
                            </span>
                        </p>
                    )}
                    {seats && !seats.full && <p className="hubHint">{t('{left} of {max} places left before approving.', seats)}</p>}

                    {progress.loading && !progress.data ? (
                        <div className="jrDialogLoading">
                            <Spinner size="sm" color="danger" /> {t('Checking the class’s courses…')}
                        </div>
                    ) : choices ? (
                        <div className="hubChoices" role="radiogroup" aria-label={t('Starts')}>
                            {options.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={from === option.key}
                                    className={`hubChoice${from === option.key ? ' isSelected' : ''}`}
                                    onClick={() => setPicked(option.key)}
                                >
                                    <span className="hubChoiceDot" aria-hidden="true" />
                                    <span>
                                        <strong>
                                            {option.title}
                                            {option.key === request.start_pref && <span className="jrAskedTag">{t('They asked for this')}</span>}
                                        </strong>
                                        <small>{option.detail}</small>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <>
                            <p className="hubHint">{hint}</p>
                            {noNext && (
                                <p className="jrWarn">
                                    <LuAlertTriangle aria-hidden="true" />
                                    {t('They asked to start from the next course, which isn’t planned yet. Approve to start them now, or plan the next routine first.')}
                                </p>
                            )}
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" startContent={saving ? null : <LuCheck aria-hidden="true" />} onPress={submit} isLoading={saving} isDisabled={(progress.loading && !progress.data) || Boolean(seats?.full)}>
                        {t('Approve')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ApproveJoinDialog;
