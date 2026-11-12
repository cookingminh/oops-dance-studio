import { useId, useState } from 'react';
import { Button, Checkbox, Input } from '@nextui-org/react';
import { LuAlertTriangle, LuCheck, LuTrash2 } from 'react-icons/lu';
import { editSessionCheck, studioMoment } from '@/services/checkins';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { CHECK_REASONS, EXCUSED_REASON, checkFormProblem, checkReasonToSave, defaultReason, isClock, lateByTimes, tidyClock, typeClock } from './checkEdit';
import './checkins.scss';

const OTHER = 'other';

// A clock time typed the 24-hour way ("1930" → 19:30), with one-tap picks under it.
const ClockField = ({ label, value, onChange, picks, autoFocus, isDisabled }) => {
    const { t } = useI18n();
    const invalid = value !== '' && !isClock(value) && value.length >= 5;
    return (
        <div className="ckClock">
            <Input
                label={label}
                labelPlacement="outside"
                value={value}
                onValueChange={(text) => onChange(typeClock(text))}
                onBlur={() => onChange(tidyClock(value))}
                placeholder="hh:mm"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                autoFocus={autoFocus}
                isDisabled={isDisabled}
                isInvalid={invalid}
                size="sm"
                classNames={{ input: 'ckClockInput' }}
            />
            {picks.length > 0 && (
                <div className="ckPicks" role="group" aria-label={t('Quick times')}>
                    {picks.map((pick) => (
                        <button key={pick.label} type="button" aria-pressed={value === pick.time} disabled={isDisabled} onClick={() => onChange(pick.time)}>
                            {pick.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Staff correct a session's check-in or check-out right where it shows (the session modal's two tiles):
// the time (24-hour, with the session's start / end and "now" one tap away), why — a ready-made reason picked
// to suit (a missing check-out was forgotten, a time already there was wrong), or their own — and, for a
// check-out, whether it counts as late (worked out from the times; "kept back by the studio" excuses it).
// session_edit_check saves both times and logs it with the times before and after.
//   which 'in' | 'out'   session { cls, date, start, end, row }   today 'yyyy-MM-dd'   now 'HH:mm'
const CheckEditor = ({ which, session, today, now, onCancel, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const id = useId();
    const { date, row } = session;
    const [checkin, setCheckin] = useState(row.checkin_at ? formatClock(row.checkin_at) : session.start || '');
    const [checkout, setCheckout] = useState(row.checkout_at ? formatClock(row.checkout_at) : which === 'out' ? session.end || '' : '');
    const [reasonKey, setReasonKey] = useState(defaultReason(which, row));
    const [ownReason, setOwnReason] = useState('');
    const [lateOverride, setLateOverride] = useState(null); // null = from the times
    const [problem, setProblem] = useState('');
    const [saving, setSaving] = useState(false);

    const reason = reasonKey === OTHER ? ownReason : t(reasonKey);
    const formProblem = checkFormProblem({ checkin, checkout, reason });
    const byTimes = lateByTimes(isClock(checkout) ? checkout : null, session.end);
    const late = lateOverride ?? Boolean(byTimes);
    const showIn = which === 'in' || !row.checkin_at;
    const showOut = which === 'out';
    const nowPick = date === today && now ? [{ label: t('Now {time}', { time: now }), time: now }] : [];

    const pickReason = (key) => {
        setReasonKey(key);
        setProblem('');
        if (key === EXCUSED_REASON) setLateOverride(false);
        else if (lateOverride === false) setLateOverride(null);
    };

    const save = async (checkoutValue = checkout) => {
        const problemNow = checkFormProblem({ checkin, checkout: checkoutValue, reason });
        if (problemNow || saving) {
            setProblem(problemNow ? t(problemNow) : '');
            return;
        }
        setSaving(true);
        setProblem('');
        try {
            await editSessionCheck({
                attendanceId: row.id,
                checkinAt: studioMoment(date, checkin),
                checkoutAt: checkoutValue ? studioMoment(date, checkoutValue) : null,
                late: checkoutValue ? lateOverride : null,
                reason: checkReasonToSave(reason, t),
            });
            toast.success('Check-in times corrected.');
            onSaved();
        } catch (error) {
            setProblem(t(error.message));
            setSaving(false);
        }
    };

    return (
        <form
            className={`ckEditor is-${which}`}
            aria-labelledby={`${id}-title`}
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
            noValidate
        >
            <p className="ckEditorTitle" id={`${id}-title`}>
                {which === 'in' ? t('Correct the check-in') : t('Correct the check-out')}
            </p>
            <div className="ckEditorTimes">
                {showIn && (
                    <ClockField
                        label={t('Check-in')}
                        value={checkin}
                        onChange={setCheckin}
                        autoFocus={which === 'in'}
                        isDisabled={saving}
                        picks={[...(session.start ? [{ label: t('Start {time}', { time: session.start }), time: session.start }] : []), ...nowPick]}
                    />
                )}
                {showOut && (
                    <ClockField
                        label={t('Check-out')}
                        value={checkout}
                        onChange={setCheckout}
                        autoFocus
                        isDisabled={saving}
                        picks={[...(session.end ? [{ label: t('End {time}', { time: session.end }), time: session.end }] : []), ...nowPick]}
                    />
                )}
            </div>

            {showOut && isClock(checkout) && (
                <Checkbox size="sm" isSelected={late} onValueChange={setLateOverride} isDisabled={saving} classNames={{ base: 'ckLateBox' }}>
                    <span>{t('Counts as a late check-out')}</span>
                    <small>
                        {byTimes
                            ? t('More than 10 minutes after the end ({end}).', { end: session.end })
                            : session.end
                              ? t('Within 10 minutes of the end ({end}).', { end: session.end })
                              : ''}
                    </small>
                </Checkbox>
            )}

            <div className="ckReason">
                <span className="ckEditorLabel" id={`${id}-why`}>
                    {t('Why')}
                </span>
                <div className="ckPicks isReasons" role="radiogroup" aria-labelledby={`${id}-why`}>
                    {[...CHECK_REASONS, OTHER].map((key) => (
                        <button key={key} type="button" role="radio" aria-checked={reasonKey === key} disabled={saving} onClick={() => pickReason(key)}>
                            {key === OTHER ? t('Other…') : t(key)}
                        </button>
                    ))}
                </div>
                {reasonKey === OTHER && (
                    <Input size="sm" autoFocus aria-label={t('Reason')} placeholder={t('Say why, in a few words')} value={ownReason} onValueChange={setOwnReason} maxLength={300} isDisabled={saving} />
                )}
            </div>

            {/* The times out of order shows at once; anything else after Save. */}
            {(problem || formProblem === 'The check-out comes after the check-in.') && (
                <p className="ckProblem" role="alert">
                    <LuAlertTriangle aria-hidden="true" />
                    <span>{problem || t(formProblem)}</span>
                </p>
            )}

            <div className="ckEditorActions">
                {showOut && row.checkout_at && (
                    <Button size="sm" variant="light" color="danger" startContent={<LuTrash2 aria-hidden="true" />} isDisabled={saving} onPress={() => save('')} className="ckRemove">
                        {t('Remove the check-out')}
                    </Button>
                )}
                <Button size="sm" variant="light" onPress={onCancel} isDisabled={saving}>
                    {t('Cancel')}
                </Button>
                <Button size="sm" type="submit" color="danger" isLoading={saving} isDisabled={Boolean(formProblem)} startContent={saving ? null : <LuCheck aria-hidden="true" />}>
                    {t('Save')}
                </Button>
            </div>
        </form>
    );
};

export default CheckEditor;
