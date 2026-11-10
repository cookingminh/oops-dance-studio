import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@nextui-org/react';
import { LuBuilding2, LuUser } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { cancelQuote } from '@/services/bookingRefunds';
import { bookingReceived } from '@/services/bookingPayments';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { quoteStep } from '@/ui/refunds/refundText';
import { guestName } from '../../bookingsModel';
import { REFUND_REASONS, refundProblem } from './refundModel';
import './refunds.scss';

// Who asked to cancel: the guest (the policy decides what goes back) or the studio (everything back).
const WHO = [
    { key: 'guest', label: 'Guest asked', hint: 'By the policy', icon: LuUser },
    { key: 'studio', label: 'Studio cancels', hint: 'Full refund', icon: LuBuilding2 },
];

// Staff cancel a booking: who asked, what the policy gives back for that (booking_cancel_quote), and the
// amount — prefilled with it; another amount needs a reason (the server refuses it otherwise).
// onConfirm(id, { byStudio, refund, note }) → true when it worked (useBookingActions.confirmCancel).
const StaffCancelDialog = ({ booking, onClose, onConfirm }) => {
    const { t, formatDate } = useI18n();
    const quotes = useAsync(() => Promise.all([cancelQuote(booking.id), cancelQuote(booking.id, { byStudio: true })]), [booking.id]);
    const [who, setWho] = useState('guest');
    const [amount, setAmount] = useState(null); // null = what the policy gives
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const quote = quotes.data?.[who === 'studio' ? 1 : 0];
    const received = Number(quote?.received ?? bookingReceived(booking));
    const policyRefund = Number(quote?.refund ?? 0);
    const typed = amount ?? String(policyRefund);
    const value = Number(typed);
    const changed = typed !== '' && Number.isFinite(value) && Math.round(value) !== policyRefund;
    // The amount must be 0 … received; another amount than the policy's also needs a reason (the field
    // says so; the button waits for it).
    const amountProblem = quote ? refundProblem({ typed, received, changed: false, note }, t, '') : '';
    const problem = amountProblem || (quote && changed && !note.trim() ? 'reason' : '');
    const keep = received - (amountProblem ? policyRefund : value);
    const step = quote && quoteStep(quote);

    const pickWho = (key) => {
        setWho(key);
        setAmount(null);
    };

    const submit = async (event) => {
        event?.preventDefault();
        if (!quote || problem || saving) return;
        setSaving(true);
        const ok = await onConfirm(booking.id, { byStudio: who === 'studio', refund: changed ? Math.round(value) : null, note: note.trim() || null });
        setSaving(false);
        if (ok) onClose();
    };

    const where = [guestName(booking, t), booking.room?.name, `${formatDate(booking.date, 'short')} ${formatTimeRange(booking.start_time, booking.end_time)}`].filter(Boolean);

    return (
        <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'bdMoneyDialog scCancelDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader className="bdMoneyHead">
                        <span>{t('Cancel booking #{id}', { id: booking.id })}</span>
                        <small>{where.join(' · ')}</small>
                    </ModalHeader>
                    <ModalBody className="bdMoneyBody">
                        <div className="scWho" role="group" aria-label={t('Who asked to cancel?')}>
                            {WHO.map((option) => (
                                <button key={option.key} type="button" aria-pressed={who === option.key} onClick={() => pickWho(option.key)}>
                                    <option.icon aria-hidden="true" />
                                    <span>
                                        <strong>{t(option.label)}</strong>
                                        <small>{t(option.hint)}</small>
                                    </span>
                                </button>
                            ))}
                        </div>

                        {!quote ? (
                            quotes.error ? (
                                <p className="bdMoneyHint isError">{t(quotes.error.message)}</p>
                            ) : (
                                <div className="scLoading">
                                    <Spinner size="sm" color="danger" /> {t('Working out the refund…')}
                                </div>
                            )
                        ) : received <= 0 ? (
                            <p className="scQuote isEmpty">{t('Nothing was paid, so there’s nothing to refund.')}</p>
                        ) : (
                            <>
                                <dl className="scQuote" aria-live="polite">
                                    <div>
                                        <dt>{t('Received')}</dt>
                                        <dd>{formatVnd(received)}</dd>
                                    </div>
                                    <div className="isStep">
                                        <dt>{t(step.key, step.vars)}</dt>
                                        <dd>{formatVnd(policyRefund)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Studio keeps')}</dt>
                                        <dd>{formatVnd(keep)}</dd>
                                    </div>
                                </dl>
                                <Input
                                    type="number"
                                    label={t('Refund (VND)')}
                                    value={typed}
                                    onValueChange={setAmount}
                                    min={0}
                                    max={received}
                                    step={1000}
                                    description={changed ? t('The policy gives {amount}.', { amount: formatVnd(policyRefund) }) : t('As the policy says.')}
                                />
                                {changed && (
                                    <div className="tuQuick">
                                        <button type="button" onClick={() => setAmount(null)}>
                                            {t('Back to {amount}', { amount: formatVnd(policyRefund) })}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        <Input
                            label={t('Reason')}
                            value={note}
                            onValueChange={setNote}
                            maxLength={300}
                            isRequired={changed}
                            placeholder={changed ? undefined : t('Optional')}
                            description={changed ? t('Needed because the amount differs from the policy.') : undefined}
                        />
                        <div className="tuQuick" role="group" aria-label={t('Common reasons')}>
                            {REFUND_REASONS.map((text) => (
                                <button key={text} type="button" onClick={() => setNote(t(text))}>
                                    {t(text)}
                                </button>
                            ))}
                        </div>
                        {amountProblem && <p className="bdMoneyHint isError">{amountProblem}</p>}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onClose} isDisabled={saving}>
                            {t('Keep the booking')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={!quote || Boolean(problem)}>
                            {t('Cancel booking')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default StaffCancelDialog;
