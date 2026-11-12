import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@nextui-org/react';
import { LuAlertTriangle, LuArrowUpRight, LuBan, LuCalendarCheck, LuCalendarClock, LuCalendarOff, LuCalendarPlus, LuCheck, LuClock, LuListChecks, LuRotateCcw } from 'react-icons/lu';
import { updateInstructorAttendance } from '@/services/attendance';
import { classImageUrl } from '@/services/storage';
import { formatClock, formatTime } from '@/lib/format';
import { placeOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { MapLink, PlaceIcon } from '@/ui/place/PlaceParts';
import placeholder from '@/assets/images/logo-mark.webp';
import MakeUpTag from '../../body/class-manager/routines/MakeUpTag';
import { classPath, sessionTimes } from '../../body/class-hub/hubModel';
import { useStudioClock } from '../useStudioClock';
import RescheduleDialog from '../session-changes/RescheduleDialog';
import CheckEditor from '../checkins/CheckEditor';
import LateTag from '../checkins/LateTag';
import { changeDay, reasonText } from '../session-changes/changeText';
import RollCall from './RollCall';
import { CheckStep, InstructorBlock, NoteBox, ProofDialog } from './SessionParts';
import { OPEN_STATUSES, canReschedule, classColor, isSubstitute, sessionRules, sessionState, teacherOf } from './sessionModel';
import { useSessionDetail } from './useSessionDetail';
import '../session-changes/sessionChanges.scss';
import './sessionModal.scss';

// One class session in a dialog, the same on the attendance page and on the class page: when and
// where, who teaches (a substitute for this session), the check-in / check-out with proof photos,
// approve / reopen, call off or move it (today or ahead, also before its record exists), the note and
// the students' roll call. Staff correct the check-in / check-out times from their tiles, with a reason (a late
// check-out is marked). A session called off says why and when it is made up — the make-up is scheduled through the
// same dialog, also for a day already past, so it says which day it replaces; a make-up says which day
// it replaces. It loads the session itself and reloads after every change; `onChanged` tells the page to
// refresh its own data.
//   session   { cls, date, row?, ... } (from sessionModel)   focus  'roll': scroll to the roll call
//   classLink the class name links to the class page
const SessionModal = ({ session, today, instructors = [], readOnly = false, focus, classLink = false, onClose, onChanged }) => {
    const i18n = useI18n();
    const { t, formatDate } = i18n;
    const toast = useToast();
    const now = useStudioClock();
    const { cls, date } = session;
    const [version, setVersion] = useState(0);
    const detail = useSessionDetail(cls.id, date, version);
    const [busy, setBusy] = useState(null); // 'approve' | 'cancel' | 'reopen' | 'substitute' | 'note'
    const [proof, setProof] = useState(null);
    const [changing, setChanging] = useState(null); // 'move' (call off / move) | 'makeUp' (make-up of a called-off session)
    const [editingCheck, setEditingCheck] = useState(null); // 'in' | 'out': the tile whose time is being corrected
    const rollRef = useRef(null);

    const loaded = detail.data !== undefined;
    const row = loaded ? detail.data.row : session.row;
    const current = { ...session, row, extra: Boolean(row?.is_extra ?? session.extra), ...sessionTimes(cls, date, row) };
    const roll = detail.data?.roll ?? [];
    const state = sessionState(current, today, now);
    const rules = sessionRules(current, today, readOnly);
    const cancelled = row?.status === 'cancelled';
    const teacher = teacherOf(current);
    const reschedule = canReschedule(current, today, readOnly);
    const madeUp = detail.data?.makeUp ?? null;
    const reason = reasonText(row?.cancel_reason, t);
    const place = placeOf(row, cls);
    // A forgotten check-out, a wrong time: staff correct them from the tiles, with a reason (logged).
    const canEditTimes = Boolean(row) && !cancelled && !readOnly && date <= today;
    const toggleCheck = (which) => () => setEditingCheck((open) => (open === which ? null : which));

    // "Take roll call": on a narrow screen the roll call sits below the session, so bring it up.
    useEffect(() => {
        if (focus !== 'roll' || !loaded || !window.matchMedia('(max-width: 900px)').matches) return undefined;
        const timer = setTimeout(() => rollRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
        return () => clearTimeout(timer);
    }, [focus, loaded]);

    const refresh = () => {
        setVersion((value) => value + 1);
        onChanged?.();
    };

    // Static toast messages are translated by the toast provider.
    const update = async (kind, fields, message) => {
        setBusy(kind);
        try {
            await updateInstructorAttendance(row.id, fields);
            toast.success(message);
            refresh();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusy(null);
        }
    };

    const approve = () => update('approve', { status: 'completed' }, 'Marked as completed.');
    const reopen = () => update('reopen', { status: 'pending' }, 'Session reopened.');
    const cancel = () =>
        window.confirm(t('Cancel this session? It won’t count for the routine, which then ends one session later.')) &&
        update('cancel', { status: 'cancelled' }, 'Session cancelled.');

    let review = null;
    if (state.kind === 'review') {
        review = row?.status === 'in_progress' ? t('Checked in {time}, never checked out', { time: formatClock(row.checkin_at) }) : t('No check-in');
    }

    const name = cls.name;
    return (
        <>
            <Modal
                isOpen
                onOpenChange={(open) => !open && onClose()}
                size="4xl"
                placement="center"
                scrollBehavior="inside"
                classNames={{ base: 'adminPortal sessionModal', header: 'smHeader', body: 'smBody', footer: 'smFooter' }}
            >
                <ModalContent>
                    <ModalHeader>
                        <span className="smAccent" style={{ background: classColor(cls.id) }} aria-hidden="true" />
                        <img className="smThumb" src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
                        <span className="smTitle">
                            <span className="smName">
                                {classLink ? (
                                    <Link to={classPath(cls.id)} className="smClassLink">
                                        {name}
                                        <LuArrowUpRight aria-hidden="true" />
                                    </Link>
                                ) : (
                                    name
                                )}
                                {current.extra && <MakeUpTag />}
                            </span>
                            <span className="smWhen">
                                <span>{formatDate(date, 'full')}</span>
                                {row?.makes_up && <span className="smReplaces">{t('Make-up for {day}', { day: changeDay(row.makes_up, i18n) })}</span>}
                                <span>
                                    <LuClock aria-hidden="true" /> {current.start ? `${current.start}–${current.end}` : t('No time set')}
                                </span>
                                {place.name && (
                                    <span>
                                        <PlaceIcon place={place} /> {place.name}
                                        <MapLink place={place} compact />
                                    </span>
                                )}
                            </span>
                        </span>
                        <span className={`phaseBadge tone-${state.tone}`}>
                            {state.tone === 'live' && <span className="livePulse" aria-hidden="true" />}
                            {t(state.key, state.vars)}
                        </span>
                    </ModalHeader>

                    <ModalBody>
                        <div className="smGrid">
                            <section className="smSide" aria-label={t('Session')}>
                                <InstructorBlock
                                    key={`${row?.id}-${row?.instructor_id}`}
                                    teacher={teacher}
                                    regular={cls.instructor}
                                    substitute={isSubstitute(current)}
                                    canChange={rules.substitute}
                                    instructors={instructors}
                                    busy={busy === 'substitute'}
                                    onChange={(instructorId) => update('substitute', { instructorId }, 'Instructor changed.')}
                                />

                                {review && (
                                    <p className="smAlert">
                                        <LuAlertTriangle aria-hidden="true" />
                                        <span>
                                            <strong>{review}</strong> {t('Mark completed if the class happened, cancel it if not.')}
                                        </span>
                                    </p>
                                )}

                                {row && !cancelled && (
                                    <ol className="smChecks">
                                        <CheckStep
                                            label={t('Check-in')}
                                            proofLabel={t('Check-in proof')}
                                            at={row.checkin_at}
                                            proof={row.checkin_proof_url}
                                            onView={setProof}
                                            onEdit={canEditTimes ? toggleCheck('in') : undefined}
                                            editing={editingCheck === 'in'}
                                            editLabel={row.checkin_at ? t('Correct the check-in') : t('Set the check-in')}
                                        />
                                        <CheckStep
                                            label={t('Check-out')}
                                            proofLabel={t('Check-out proof')}
                                            at={row.checkout_at}
                                            proof={row.checkout_proof_url}
                                            onView={setProof}
                                            onEdit={canEditTimes ? toggleCheck('out') : undefined}
                                            editing={editingCheck === 'out'}
                                            editLabel={row.checkout_at ? t('Correct the check-out') : t('Set the check-out')}
                                        />
                                    </ol>
                                )}
                                {editingCheck && canEditTimes && (
                                    <CheckEditor
                                        key={`${editingCheck}-${row.id}`}
                                        which={editingCheck}
                                        session={current}
                                        today={today}
                                        now={now}
                                        onCancel={() => setEditingCheck(null)}
                                        onSaved={() => {
                                            setEditingCheck(null);
                                            refresh();
                                        }}
                                    />
                                )}
                                {canEditTimes && !editingCheck && <p className="smHint">{t('Tap a time to correct it.')}</p>}
                                {row?.checkout_late && !cancelled && (
                                    <p className="smLateLine">
                                        <LateTag />
                                        <span>{current.end ? t('More than 10 minutes after the end ({end}).', { end: current.end }) : t('More than 10 minutes after the end.')}</span>
                                    </p>
                                )}
                                {!row && loaded && (
                                    <p className="smHint">{date >= today ? t('The check-in record is created with the week’s records.') : t('No check-in record for this day.')}</p>
                                )}

                                {cancelled && (
                                    <div className="smCancelled">
                                        {reason && (
                                            <p className="smReason">
                                                <LuCalendarOff aria-hidden="true" />
                                                <span>{t('Called off: {reason}', { reason })}</span>
                                            </p>
                                        )}
                                        {madeUp ? (
                                            <>
                                                <p className="smMadeUp">
                                                    <LuCalendarCheck aria-hidden="true" />
                                                    <span>
                                                        {t('Made up on {day}, {time}', {
                                                            day: changeDay(madeUp.date, i18n),
                                                            time: `${formatTime(madeUp.start_time)}–${formatTime(madeUp.end_time)}`,
                                                        })}
                                                    </span>
                                                </p>
                                                <p>{t('This session was cancelled. The make-up counts for the routine in its place.')}</p>
                                            </>
                                        ) : (
                                            <p>{t('This session was cancelled. It doesn’t count for the routine, so the routine (and its shoot day) moves one session later.')}</p>
                                        )}
                                        {!madeUp && !readOnly && (
                                            <Button size="sm" variant="flat" startContent={<LuCalendarPlus aria-hidden="true" />} onPress={() => setChanging('makeUp')}>
                                                {t('Add a make-up session')}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {(rules.approve || rules.reopen || rules.cancel || reschedule) && (
                                    <div className="smActions">
                                        {rules.approve && (
                                            <Button
                                                size="sm"
                                                color="success"
                                                className="text-white"
                                                startContent={<LuCheck aria-hidden="true" />}
                                                isLoading={busy === 'approve'}
                                                isDisabled={Boolean(busy) && busy !== 'approve'}
                                                onPress={approve}
                                            >
                                                {t('Mark completed')}
                                            </Button>
                                        )}
                                        {rules.reopen && (
                                            <Button size="sm" variant="flat" startContent={<LuRotateCcw aria-hidden="true" />} isLoading={busy === 'reopen'} isDisabled={Boolean(busy) && busy !== 'reopen'} onPress={reopen}>
                                                {t('Reopen session')}
                                            </Button>
                                        )}
                                        {reschedule && (
                                            <Button size="sm" color="danger" variant="flat" startContent={<LuCalendarClock aria-hidden="true" />} isDisabled={Boolean(busy)} onPress={() => setChanging('move')}>
                                                {t('Call off / move')}
                                            </Button>
                                        )}
                                        {rules.cancel && !reschedule && (
                                            <Button
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                startContent={<LuBan aria-hidden="true" />}
                                                isLoading={busy === 'cancel'}
                                                isDisabled={Boolean(busy) && busy !== 'cancel'}
                                                onPress={cancel}
                                            >
                                                {t('Cancel session')}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {row && OPEN_STATUSES.includes(row.status) && !readOnly && date > today && (
                                    <p className="smHint">{t('It can be marked completed on the day of the session.')}</p>
                                )}

                                {row && (
                                    <NoteBox key={`${row.id}-${row.details ?? ''}`} details={row.details} canEdit={rules.note} busy={busy === 'note'} onSave={(details) => update('note', { details }, 'Note saved.')} />
                                )}
                            </section>

                            <section className="smMain" ref={rollRef} aria-labelledby="sm-roll-title">
                                <h3 id="sm-roll-title" className="smSectionTitle">
                                    <LuListChecks aria-hidden="true" /> {t('Roll call')}
                                </h3>
                                {loaded ? (
                                    <RollCall cls={cls} session={current} rows={roll} today={today} readOnly={readOnly} onChanged={refresh} />
                                ) : (
                                    <div className="smLoading">
                                        <Spinner size="sm" color="danger" label={t('Loading…')} />
                                    </div>
                                )}
                            </section>
                        </div>
                        {detail.error && <p className="smHint isError">{t(detail.error.message ?? 'Something went wrong.')}</p>}
                    </ModalBody>

                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t('Close')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            {proof && <ProofDialog proof={proof} onClose={() => setProof(null)} />}
            {(changing === 'move' || changing === 'makeUp') && (
                <RescheduleDialog
                    session={current}
                    today={today}
                    makeUpOnly={changing === 'makeUp'}
                    onClose={() => setChanging(null)}
                    onDone={() => {
                        setChanging(null);
                        refresh();
                    }}
                />
            )}
        </>
    );
};

export default SessionModal;
