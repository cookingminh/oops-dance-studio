import { useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@nextui-org/react';
import { LuArrowRight, LuInfo, LuPartyPopper, LuSend } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import LinkButton from '@/ui/LinkButton';
import { formatVnd } from '@/lib/format';
import { JOIN_NOTE_MAX, MAX_OPEN_REQUESTS, loadJoinOffer, requestToJoin } from '@/services/classJoin';
import { ClassFacts, ClassHead, CourseLine, CoursesSkeleton } from './JoinParts';
import { START_LABELS, joinOffer } from './joinOffer';
import './joinDialog.scss';

const dayMonth = (formatDate) => (iso) => formatDate(iso, 'dayMonth');

// The running course and the next one (shimmer while they load; nothing when the class has none).
const Courses = ({ offer, plan }) => {
    const { t, tn, formatDate } = useI18n();
    const date = dayMonth(formatDate);
    if (!plan) return offer.error ? null : <CoursesSkeleton />;
    if (!plan.now && !plan.next) return null;
    return (
        <ul className="jnCourses" aria-label={t('Courses')}>
            {plan.now && (
                <CourseLine
                    kind="now"
                    course={plan.now.course}
                    meta={t('{left} of {count} sessions left', { left: plan.now.left, count: plan.now.course.session_count })}
                />
            )}
            {plan.next && (
                <CourseLine
                    kind="next"
                    course={plan.next.course}
                    meta={`${t('From {date}', { date: date(plan.next.course.starts_on) })} · ${tn(plan.next.course.session_count, '{count} session', '{count} sessions')}`}
                />
            )}
        </ul>
    );
};

// When they'd start and what it costs: two radio cards when a course is running and the next one is planned,
// else one line. Fees only when they can be told for sure (joinOffer: feeKnown).
const StartChoice = ({ offer, plan, start, onStart }) => {
    const { t, formatDate } = useI18n();
    const date = dayMonth(formatDate);
    if (!plan && !offer.error) return null;
    const known = plan?.feeKnown;
    const notes = [];
    let body;

    if (!plan) {
        body = <p className="jnOneLine">{t('The studio confirms when you start and the fee when it approves your request.')}</p>;
    } else if (plan.choice) {
        const { now, next } = plan;
        let nowDetail = t('Join “{title}”, the course running now.', { title: now.course.title });
        if (known && now.prorated) {
            nowDetail = t('Join “{title}” and pay for the {count} sessions left.', { title: now.course.title, count: now.sessions });
        } else if (known && now.late) {
            // No pro-rata (the default): joining late still costs the whole course, so say how much of it is left.
            nowDetail = t('Join “{title}” now: you pay the full course fee, with {left} of its {count} sessions left.', {
                title: now.course.title,
                left: now.left,
                count: now.course.session_count,
            });
        } else if (known) {
            nowDetail = t('Join “{title}” and pay for the whole course.', { title: now.course.title });
        }
        const nextDetail = known
            ? t('“{title}”, starting {date}: the whole course.', { title: next.course.title, date: date(next.course.starts_on) })
            : t('“{title}”, starting {date}.', { title: next.course.title, date: date(next.course.starts_on) });
        const options = [
            { key: 'now', detail: nowDetail, amount: known ? now.amount : null },
            { key: 'next', detail: nextDetail, amount: known ? next.amount : null },
        ];
        body = (
            <div className="jnChoices" role="radiogroup" aria-labelledby="jn-start">
                {options.map((option) => (
                    <label key={option.key} className={`jnChoice${start === option.key ? ' isSelected' : ''}`}>
                        <input type="radio" name="jn-start" value={option.key} checked={start === option.key} onChange={() => onStart(option.key)} />
                        <span className="jnChoiceText">
                            <strong>{t(START_LABELS[option.key])}</strong>
                            <small>{option.detail}</small>
                        </span>
                        {option.amount != null && <span className="jnFee">{formatVnd(option.amount)}</span>}
                    </label>
                ))}
            </div>
        );
    } else {
        let line = t('No course is planned for this class yet: you’re billed once the studio sets its next routine.');
        let amount = null;
        if (plan.now) {
            const { course } = plan.now;
            line = t('You join “{title}”, the course running now.', { title: course.title });
            if (known) {
                if (plan.now.prorated) {
                    line = t('You join “{title}” now and pay for the {count} sessions left.', { title: course.title, count: plan.now.sessions });
                } else if (plan.now.late) {
                    line = t('You join “{title}” now and pay the full course fee, with {left} of its {count} sessions left.', {
                        title: course.title,
                        left: plan.now.left,
                        count: course.session_count,
                    });
                } else {
                    line = t('You join “{title}” now and pay for the whole course.', { title: course.title });
                }
                amount = plan.now.amount;
            }
        } else if (plan.next) {
            const { course } = plan.next;
            line = known
                ? t('You start with “{title}” on {date} and pay for the whole course.', { title: course.title, date: date(course.starts_on) })
                : t('You start with “{title}” on {date}.', { title: course.title, date: date(course.starts_on) });
            amount = known ? plan.next.amount : null;
        }
        body = (
            <p className="jnOneLine">
                <span>{line}</span>
                {amount != null && <span className="jnFee">{formatVnd(amount)}</span>}
            </p>
        );
    }

    const startingNow = plan && (!plan.choice || start === 'now');
    if (known && startingNow && plan.prorates) notes.push(t('The fee counts the sessions left on the day the studio adds you.'));
    if (known && startingNow && plan.nextBilledToo) {
        notes.push(
            t('Sign-up for “{title}” is already open, so you also get its invoice ({amount}) and can say then whether you carry on.', {
                title: plan.next.course.title,
                amount: formatVnd(plan.next.amount),
            })
        );
    }
    if (plan && !known && (plan.now || plan.next)) notes.push(t('The studio confirms the fee when it approves your request.'));

    return (
        <section className="jnStart" aria-labelledby="jn-start">
            <h3 id="jn-start" className="jnLabel">
                {plan?.choice ? t('When would you like to start?') : t('When you start')}
            </h3>
            {body}
            {notes.map((text) => (
                <p key={text} className="jnHint">
                    <LuInfo aria-hidden="true" />
                    <span>{text}</span>
                </p>
            ))}
        </section>
    );
};

// Asking to join a class (a student): the class, its courses, when they'd start (now or from the next course, when
// both exist) with what that costs, a note for the studio and what happens next. "Send request" turns the dialog
// into a "Request sent!" view; the card behind it then shows the request as waiting (onSent).
// `item` is a list_public_classes() row; `pendingCount` how many requests the student already has waiting.
const JoinDialog = ({ item, pendingCount = 0, onClose, onSent }) => {
    const { t } = useI18n();
    const toast = useToast();
    const offer = useAsync(() => loadJoinOffer(item.id), [item.id]);
    const [start, setStart] = useState('now');
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const closeRef = useRef(null);

    // The form (and the field that had the focus) is gone: move the focus into the "Request sent!" view, so the
    // keyboard (Escape, Tab) still works there.
    useEffect(() => {
        if (!sent) return undefined;
        const frame = requestAnimationFrame(() => closeRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [sent]);

    const plan = offer.data ? joinOffer(offer.data, item.price) : null;
    const full = pendingCount >= MAX_OPEN_REQUESTS;
    const ready = Boolean(plan) || Boolean(offer.error);

    const send = async (event) => {
        event?.preventDefault();
        if (sending || full || !ready) return;
        setSending(true);
        try {
            await requestToJoin(item.id, { start: plan?.choice ? start : 'now', note });
            setSent(true);
            onSent?.();
        } catch (error) {
            toast.error(error);
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            placement="center"
            scrollBehavior="inside"
            size="lg"
            classNames={{ base: 'jnDialog', closeButton: 'jnClose' }}
        >
            <ModalContent>
                {sent ? (
                    <>
                        <ModalHeader>
                            <ClassHead item={item} eyebrow={t('Ask to join')} />
                        </ModalHeader>
                        <ModalBody className="jnBody jnDone">
                            <span className="jnDoneArt" aria-hidden="true">
                                <LuPartyPopper />
                            </span>
                            <h3>{t('Request sent!')}</h3>
                            <p>{t('The studio will look at it soon, usually within a day. You can follow it, or cancel it, in My classes.')}</p>
                        </ModalBody>
                        <ModalFooter className="jnFoot">
                            <LinkButton to="/profile/my-classes" variant="light">
                                {t('Go to My classes')} <LuArrowRight aria-hidden="true" />
                            </LinkButton>
                            <Button ref={closeRef} color="danger" onPress={onClose}>
                                {t('Close')}
                            </Button>
                        </ModalFooter>
                    </>
                ) : (
                    <form onSubmit={send} noValidate>
                        <ModalHeader>
                            <ClassHead item={item} eyebrow={t('Ask to join')} />
                        </ModalHeader>
                        <ModalBody className="jnBody">
                            <ClassFacts item={item} />
                            <Courses offer={offer} plan={plan} />
                            <StartChoice offer={offer} plan={plan} start={start} onStart={setStart} />
                            <Textarea
                                label={t('A note for the studio (optional)')}
                                placeholder={t('Anything we should know? Your dance experience, goals…')}
                                value={note}
                                onValueChange={(value) => setNote(value.slice(0, JOIN_NOTE_MAX))}
                                maxLength={JOIN_NOTE_MAX}
                                minRows={2}
                                description={t('{count} of {max} characters', { count: note.length, max: JOIN_NOTE_MAX })}
                                classNames={{ base: 'jnNote' }}
                            />
                            <section className="jnSteps" aria-labelledby="jn-steps">
                                <h3 id="jn-steps" className="jnLabel">
                                    {t('What happens after you ask')}
                                </h3>
                                <ol>
                                    <li>{t('The studio reviews your request, usually within a day.')}</li>
                                    <li>{t('You’re added to the class and get the invoice.')}</li>
                                    <li>{t('Pay, and see you in class!')}</li>
                                </ol>
                            </section>
                            {full && (
                                <p className="jnWarn" role="note">
                                    <LuInfo aria-hidden="true" />
                                    {t('You have 3 requests waiting already. Wait for an answer, or cancel one, before asking again.')}
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter className="jnFoot">
                            <Button variant="light" onPress={onClose} isDisabled={sending}>
                                {t('Cancel')}
                            </Button>
                            <Button
                                type="submit"
                                color="danger"
                                isLoading={sending}
                                isDisabled={full || !ready}
                                startContent={sending ? null : <LuSend aria-hidden="true" />}
                            >
                                {t('Send request')}
                            </Button>
                        </ModalFooter>
                    </form>
                )}
            </ModalContent>
        </Modal>
    );
};

export default JoinDialog;
