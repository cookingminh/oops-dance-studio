import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@nextui-org/react';
import { LuQrCode, LuRepeat, LuWallet, LuZap } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { cancelSeriesRest, recordSeriesPayment, seriesQrUrl, seriesSummary, seriesTransferContent, simulateSeriesTransfer } from '@/services/bookingSeries';
import { formatTime, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { DeskPanel, QrPanel } from '@/ui/payment/QrPanel';
import CopyRow from '@/ui/payment/CopyRow';
import { PaidCelebration, SandboxBox, WaitingNote } from '@/ui/payment/PayExtras';
import Segmented from '../../../../common/Segmented';
import { capitalized } from '../../bookingsModel';

const POLL_MS = 3000;

// One month of a series by bank transfer: its QR code (what the month still owes, with its code), updated by itself
// once the bank confirms; the demo can pretend the transfer came in.
const SeriesPayDialog = ({ seriesId, month, settings, sandbox, onClose, onChanged }) => {
    const { t, monthName } = useI18n();
    const toast = useToast();
    const [row, setRow] = useState(month);
    const [simulating, setSimulating] = useState(false);
    const onChangedRef = useRef(onChanged);
    useEffect(() => {
        onChangedRef.current = onChanged;
    }, [onChanged]);

    const reload = useCallback(async () => {
        const fresh = (await seriesSummary(seriesId)).months.find((item) => item.month === month.month);
        if (!fresh) return;
        setRow((old) => {
            if (Number(fresh.paid) > Number(old.paid)) {
                toast.success('Transfer received. Thank you!');
                onChangedRef.current?.();
            }
            return fresh;
        });
    }, [seriesId, month.month, toast]);

    const waiting = Number(row.balance) > 0;
    useEffect(() => {
        if (!waiting) return undefined;
        const timer = setInterval(() => document.visibilityState === 'visible' && reload().catch(() => {}), POLL_MS);
        return () => clearInterval(timer);
    }, [waiting, reload]);

    const amount = Number(row.balance);
    const qr = seriesQrUrl(settings, row.code, row.month, amount);
    const simulate = async () => {
        setSimulating(true);
        try {
            await simulateSeriesTransfer(seriesId, row.month);
            await reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setSimulating(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} size="3xl" placement="center" scrollBehavior="inside" classNames={{ base: 'tuPayModal bkPayModal adminPortal', closeButton: 'tuModalClose' }}>
            <ModalContent>
                <ModalHeader className="tuPayHead">
                    <span className="tuPayHeadIcon" aria-hidden="true">
                        <LuQrCode />
                    </span>
                    <span>
                        <span className="tuPayTitle">{t('Pay {month} of the rental', { month: monthName(row.month, { withYear: true }) })}</span>
                        <span className="tuPaySub">{t('{count} sessions · {total}', { count: row.sessions, total: formatVnd(row.total) })}</span>
                    </span>
                </ModalHeader>
                <ModalBody className="tuPayBody">
                    {!waiting ? (
                        <PaidCelebration title={t('Paid in full. Thank you!')} text={t('Every session of this month is paid.')} amount={formatVnd(row.paid)} onDone={onClose} />
                    ) : (
                        <div className="tuPayGrid">
                            <div className="tuPayLeft">
                                {qr ? <QrPanel qr={qr} due={amount} sandbox={sandbox} /> : <DeskPanel code={row.code} due={amount} />}
                                <WaitingNote title={t('Waiting for the transfer…')} text={t('This updates by itself a few seconds after the bank confirms.')} />
                            </div>
                            <div className="tuPayInfo">
                                {qr && (
                                    <dl className="tuCopyList">
                                        <CopyRow label={t('Bank')} value={settings.bank_name || settings.bank_code} />
                                        <CopyRow label={t('Account number')} value={settings.account_no} mono />
                                        {settings.account_name && <CopyRow label={t('Account name')} value={settings.account_name} />}
                                        <CopyRow label={t('Amount')} value={formatVnd(amount)} copyText={String(amount)} />
                                        <CopyRow label={t('Transfer content')} value={seriesTransferContent(row.code, row.month)} isKey />
                                    </dl>
                                )}
                                <p className="bkAutoNote">
                                    <LuZap aria-hidden="true" />
                                    <span>
                                        <strong>{t('Recorded automatically when the transfer arrives')}</strong>
                                        <small>{t('Keep {code} in the transfer content: it pays this month’s sessions, earliest first.', { code: row.code })}</small>
                                    </span>
                                </p>
                                {sandbox && (
                                    <SandboxBox
                                        text={t('No real money moves here. Pretend the renter sent this transfer and watch the month update by itself.')}
                                        label={t('Simulate the transfer')}
                                        busy={simulating}
                                        onSimulate={simulate}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </ModalBody>
                {waiting && (
                    <ModalFooter className="tuPayFoot">
                        <Button variant="light" onPress={onClose}>
                            {t('Close')}
                        </Button>
                    </ModalFooter>
                )}
            </ModalContent>
        </Modal>
    );
};

// Money for a month taken at the desk (cash, or a transfer seen by hand), up to what it still owes.
const SeriesCashDialog = ({ seriesId, month, onClose, onDone }) => {
    const { t, monthName } = useI18n();
    const toast = useToast();
    const [amount, setAmount] = useState(String(month.balance));
    const [method, setMethod] = useState('cash');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const value = Math.round(Number(amount) || 0);
    const problem = value <= 0 ? t('Enter an amount in VND.') : value > Number(month.balance) ? t('More than the month still owes ({amount}).', { amount: formatVnd(month.balance) }) : '';

    const save = async () => {
        setSaving(true);
        try {
            await recordSeriesPayment(seriesId, month.month, value, method, note);
            toast.success(t('{amount} recorded for {month}.', { amount: formatVnd(value), month: monthName(month.month, { withYear: true }) }));
            onDone();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen size="md" onOpenChange={(open) => !open && !saving && onClose()} classNames={{ base: 'adminPortal' }}>
            <ModalContent>
                <ModalHeader className="flex-col items-start gap-1">
                    {t('Money taken for {month}', { month: monthName(month.month, { withYear: true }) })}
                    <span className="text-sm font-normal text-default-500">{t('Spread over its sessions, earliest first.')}</span>
                </ModalHeader>
                <ModalBody>
                    <Segmented
                        label={t('Method')}
                        options={[
                            { key: 'cash', label: t('Cash') },
                            { key: 'transfer', label: t('Transfer') },
                        ]}
                        value={method}
                        onChange={setMethod}
                    />
                    <Input type="number" label={t('Amount (VND)')} value={amount} onValueChange={setAmount} min={0} step={1000} isInvalid={Boolean(problem)} errorMessage={problem || undefined} />
                    <Input label={t('Note')} placeholder={t('Optional')} value={note} onValueChange={setNote} maxLength={300} />
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="primary" onPress={save} isLoading={saving} isDisabled={Boolean(problem)}>
                        {t('Record {amount}', { amount: formatVnd(value) })}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

// Ending the series early: its sessions still ahead are cancelled, each like a cancelled booking — the renter's
// side (the cancellation policy decides what goes back) or the studio's (everything paid goes back).
const SeriesEndDialog = ({ seriesId, ahead, onClose, onDone }) => {
    const { t, tn } = useI18n();
    const toast = useToast();
    const [side, setSide] = useState('guest');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try {
            const count = await cancelSeriesRest(seriesId, { byStudio: side === 'studio', note });
            toast.success(tn(count, '{count} session cancelled.', '{count} sessions cancelled.'));
            onDone();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };
    return (
        <Modal isOpen size="md" onOpenChange={(open) => !open && !saving && onClose()} classNames={{ base: 'adminPortal' }}>
            <ModalContent>
                <ModalHeader>{tn(ahead, 'Cancel the {count} session still ahead?', 'Cancel the {count} sessions still ahead?')}</ModalHeader>
                <ModalBody>
                    <Segmented
                        label={t('Who cancels')}
                        options={[
                            { key: 'guest', label: t('The renter (refund by the policy)') },
                            { key: 'studio', label: t('The studio (everything paid goes back)') },
                        ]}
                        value={side}
                        onChange={setSide}
                    />
                    <Textarea label={t('Note')} placeholder={t('Optional')} value={note} onValueChange={setNote} maxLength={300} />
                    <p className="text-sm text-default-500">{t('Money to give back shows on each session, under “To refund”.')}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" onPress={save} isLoading={saving}>
                        {t('Cancel them')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

// A booking that is one session of a recurring rental: the series (weekdays, times, dates, discount) and its months,
// each with what it comes to, what came in, and how to pay it (its QR code, or money taken at the desk); the
// sessions still ahead can be cancelled together.
const SeriesPanel = ({ booking, settings, sandbox, onChanged }) => {
    const { t, tn, dayName, formatDate, monthName } = useI18n();
    const [version, setVersion] = useState(0);
    const summary = useAsync(() => seriesSummary(booking.series_id), [booking.series_id, version]);
    const [paying, setPaying] = useState(null); // a month
    const [cash, setCash] = useState(null); // a month
    const [ending, setEnding] = useState(false);
    const refresh = () => {
        setVersion((value) => value + 1);
        onChanged?.();
    };

    const data = summary.data;
    if (!data) return summary.loading ? <p className="bdSeries bdMuted">{t('Loading…')}</p> : null;
    const s = data.series;
    const discount = s.discount_kind === 'percent' ? t('{value}% off', { value: s.discount_value }) : s.discount_kind === 'amount' ? t('{amount} off each session', { amount: formatVnd(s.discount_value) }) : null;

    return (
        <section className="bdSeries" aria-label={t('Regular rental')}>
            <p className="bdSeriesHead">
                <LuRepeat aria-hidden="true" />
                <strong>{t('Regular rental')}</strong>
                <span>
                    {[
                        // Each weekday with its own times (day_times), else the weekdays and the series' times.
                        ...(s.day_times
                            ? [s.weekdays.map((day) => `${dayName(day, 'short')} ${s.day_times[day]?.start ?? formatTime(s.start_time)}–${s.day_times[day]?.end ?? formatTime(s.end_time)}`).join(', ')]
                            : [s.weekdays.map((day) => dayName(day, 'short')).join(', '), `${formatTime(s.start_time)}–${formatTime(s.end_time)}`]),
                        `${formatDate(s.starts_on, 'dayMonth')} → ${formatDate(s.ends_on, 'dayMonth')}`,
                        tn(data.sessions, '{count} session', '{count} sessions'),
                    ].join(' · ')}
                </span>
                {discount && <span className="bdSeriesDiscount">{[discount, s.discount_note].filter(Boolean).join(' · ')}</span>}
            </p>
            <ul className="bdSeriesMonths">
                {data.months.map((month) => {
                    const owes = Number(month.balance) > 0;
                    return (
                        <li key={month.month}>
                            <span className="bdSeriesMonth">
                                <strong>{capitalized(monthName(month.month, { withYear: true }))}</strong>
                                <small>
                                    {tn(Number(month.sessions), '{count} session', '{count} sessions')} · {formatVnd(month.total)}
                                </small>
                            </span>
                            <span className={`bdSeriesState${owes ? ' isOwing' : ''}`}>{owes ? t('{amount} to pay', { amount: formatVnd(month.balance) }) : Number(month.sessions) ? t('Paid') : t('No sessions left')}</span>
                            {owes && (
                                <span className="bdSeriesActions">
                                    <Button size="sm" variant="flat" startContent={<LuQrCode aria-hidden="true" />} onPress={() => setPaying(month)}>
                                        {t('QR for the month')}
                                    </Button>
                                    <Button size="sm" variant="light" startContent={<LuWallet aria-hidden="true" />} onPress={() => setCash(month)}>
                                        {t('Taken at the desk')}
                                    </Button>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
            {data.ahead > 0 && (
                <Button size="sm" variant="light" color="danger" className="bdSeriesEnd" onPress={() => setEnding(true)}>
                    {tn(data.ahead, 'Cancel the {count} session still ahead', 'Cancel the {count} sessions still ahead')}
                </Button>
            )}
            {paying && <SeriesPayDialog seriesId={s.id} month={paying} settings={settings} sandbox={sandbox} onClose={() => { setPaying(null); refresh(); }} onChanged={refresh} />}
            {cash && <SeriesCashDialog seriesId={s.id} month={cash} onClose={() => setCash(null)} onDone={() => { setCash(null); refresh(); }} />}
            {ending && <SeriesEndDialog seriesId={s.id} ahead={data.ahead} onClose={() => setEnding(false)} onDone={() => { setEnding(false); refresh(); }} />}
        </section>
    );
};

export default SeriesPanel;
