import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from '@nextui-org/react';
import { LuLock, LuRotateCcw, LuShieldCheck } from 'react-icons/lu';
import { POLICY_DEFAULTS, setRefundPolicy } from '@/services/bookingRefunds';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import PolicyLines from '@/ui/refunds/PolicyLines';
import { policyLines } from '@/ui/refunds/refundText';
import { studioDay } from './refundModel';
import './refunds.scss';

const FULL_HOURS_SUGGESTION = 72; // what the full-refund step starts at when it is switched on
const whole = (value, min, max) => value !== '' && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;

// The cancellation policy (booking_settings). Admins change it — an optional full-refund step, the partial
// step (hours + percent) — and see the lines guests will read as they type; staff read it.
const RefundPolicyDialog = ({ settings, isAdmin, onClose, onSaved }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [fullOn, setFullOn] = useState(settings.refund_full_hours !== null && settings.refund_full_hours !== undefined);
    const [fullHours, setFullHours] = useState(String(settings.refund_full_hours ?? FULL_HOURS_SUGGESTION));
    const [partialHours, setPartialHours] = useState(String(settings.refund_partial_hours));
    const [percent, setPercent] = useState(String(settings.refund_partial_percent));
    const [saving, setSaving] = useState(false);

    const problem = !whole(partialHours, 1, 720) || (fullOn && !whole(fullHours, 1, 720))
        ? t('Hours are whole numbers from 1 to 720.')
        : !whole(percent, 0, 100)
            ? t('The percent is a whole number from 0 to 100.')
            : fullOn && Number(fullHours) <= Number(partialHours)
                ? t('The full refund needs more hours than the partial one.')
                : '';
    const draft = { refund_full_hours: fullOn ? Number(fullHours) : null, refund_partial_hours: Number(partialHours), refund_partial_percent: Number(percent) };
    const unchanged =
        draft.refund_full_hours === (settings.refund_full_hours ?? null) &&
        draft.refund_partial_hours === settings.refund_partial_hours &&
        draft.refund_partial_percent === settings.refund_partial_percent;
    const isDefault = !fullOn && draft.refund_partial_hours === POLICY_DEFAULTS.refund_partial_hours && draft.refund_partial_percent === POLICY_DEFAULTS.refund_partial_percent;

    const backToDefault = () => {
        setFullOn(false);
        setPartialHours(String(POLICY_DEFAULTS.refund_partial_hours));
        setPercent(String(POLICY_DEFAULTS.refund_partial_percent));
    };

    const submit = async (event) => {
        event?.preventDefault();
        if (!isAdmin || problem || unchanged || saving) return;
        setSaving(true);
        try {
            await setRefundPolicy({ fullHours: draft.refund_full_hours, partialHours: draft.refund_partial_hours, partialPercent: draft.refund_partial_percent });
            toast.success('Cancellation policy saved.');
            onSaved();
            onClose();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const updated = studioDay(settings.updated_at);

    return (
        <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()} placement="center" scrollBehavior="inside" size="lg" classNames={{ base: 'bdMoneyDialog rpDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader className="rpHead">
                        <span className="rpHeadIcon" aria-hidden="true">
                            <LuShieldCheck />
                        </span>
                        <span>
                            <span className="rpTitle">{t('Cancellation policy')}</span>
                            <small>{t('What guests get back when they cancel a booking.')}</small>
                        </span>
                    </ModalHeader>
                    <ModalBody className="bdMoneyBody rpBody">
                        {isAdmin ? (
                            <>
                                <section className="rpStep" aria-labelledby="rp-full">
                                    <Switch isSelected={fullOn} onValueChange={setFullOn} size="sm" color="danger" className="rpSwitch">
                                        <span id="rp-full" className="rpStepTitle">
                                            {t('Full refund when cancelled early')}
                                        </span>
                                    </Switch>
                                    {fullOn && (
                                        <Input
                                            type="number"
                                            label={t('Hours ahead')}
                                            value={fullHours}
                                            onValueChange={setFullHours}
                                            min={1}
                                            max={720}
                                            className="rpHours"
                                        />
                                    )}
                                </section>
                                <section className="rpStep" aria-labelledby="rp-partial">
                                    <span id="rp-partial" className="rpStepTitle">
                                        {t('Partial refund')}
                                    </span>
                                    <div className="rpPair">
                                        <Input type="number" label={t('Hours ahead')} value={partialHours} onValueChange={setPartialHours} min={1} max={720} />
                                        <Input type="number" label={t('Refund (%)')} value={percent} onValueChange={setPercent} min={0} max={100} />
                                    </div>
                                    <small className="rpHint">{t('Later than that: no refund.')}</small>
                                </section>
                                {problem && <p className="bdMoneyHint isError">{problem}</p>}
                                <section className="rfPolicyBox" aria-live="polite" aria-label={t('Guests see')}>
                                    <span className="rfPolicyTitle">{t('Guests see')}</span>
                                    <PolicyLines lines={policyLines(problem ? settings : draft)} />
                                </section>
                                {!isDefault && (
                                    <button type="button" className="bdAdvanced rpDefault" onClick={backToDefault}>
                                        <LuRotateCcw aria-hidden="true" /> {t('Back to the default ({hours} hours, {percent}%)', { hours: POLICY_DEFAULTS.refund_partial_hours, percent: POLICY_DEFAULTS.refund_partial_percent })}
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <section className="rfPolicyBox">
                                    <PolicyLines lines={policyLines(settings)} />
                                </section>
                                <p className="bdMoneyHint rpReadOnly">
                                    <LuLock aria-hidden="true" /> {t('Only an admin can change the policy.')}
                                </p>
                            </>
                        )}
                        {updated && <p className="bdMoneyHint">{t('Last changed {date}', { date: formatDate(updated, 'shortYear') })}</p>}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={saving}>
                            {t('Close')}
                        </Button>
                        {isAdmin && (
                            <Button type="submit" color="danger" isLoading={saving} isDisabled={Boolean(problem) || unchanged}>
                                {t('Save policy')}
                            </Button>
                        )}
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default RefundPolicyDialog;
