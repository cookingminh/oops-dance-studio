import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input } from '@nextui-org/react';
import { LuArrowRightLeft, LuFlag, LuRotateCcw } from 'react-icons/lu';
import { endClass } from '@/services/classes';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import DateField from '@/ui/DateField';
import Segmented from '../../../../common/Segmented';
import SwitchClassDialog from '../../../../common/switch-class/SwitchClassDialog';
import { lastDayOf, monthOf } from '../../hubModel';

// End a class: its last day (today, end of this month or a date) and why. Courses after it are
// cancelled at once; students who already paid for one are listed to switch them to another
// class (the money moves with them) or refund them. While the last day is ahead it can be undone.
const EndClassPanel = ({ cls, today, phase, onChanged, onReopen }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const monthEnd = lastDayOf(monthOf(today));
    const [choice, setChoice] = useState('today');
    const [custom, setCustom] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [paidAfter, setPaidAfter] = useState(null); // students to switch or refund after ending
    const [switching, setSwitching] = useState(null);

    const lastDay = choice === 'today' ? today : choice === 'month' ? monthEnd : custom;
    const lastDayError = choice === 'custom' && custom && (custom < today ? t('Pick today or a later day.') : cls.starts_on > custom ? t('The class only starts on {date}.', { date: formatDate(cls.starts_on, 'short') }) : '');
    const canEnd = Boolean(lastDay) && !lastDayError;

    const end = async () => {
        if (!window.confirm(t('End {name} after {date}? Courses that start later are cancelled; on the day after, its students leave and its room is freed.', { name: cls.name, date: formatDate(lastDay, 'long') }))) return;
        setSaving(true);
        try {
            const result = await endClass(cls.id, lastDay, reason.trim() || null);
            setPaidAfter(result?.paid_after ?? []);
            toast.success(t('{name} ends on {date}.', { name: cls.name, date: formatDate(lastDay, 'dayMonth') }));
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const ending = phase === 'ending' || phase === 'ended';

    return (
        <div className="hubDanger">
            {ending ? (
                <div className="hubDangerRow">
                    <span className="hubDangerIcon" aria-hidden="true">
                        <LuFlag />
                    </span>
                    <div>
                        <strong>{phase === 'ended' ? t('This class ended on {date}.', { date: formatDate(cls.ended_on, 'long') }) : t('This class ends after {date}.', { date: formatDate(cls.ended_on, 'long') })}</strong>
                        <p className="hubHint">
                            {cls.end_reason ? `“${cls.end_reason}” · ` : ''}
                            {phase === 'ended' ? t('Reopening brings back its weekly sessions where the room is still free.') : t('Changed your mind? Keep it running and nothing is lost.')}
                        </p>
                    </div>
                    <Button variant="flat" startContent={<LuRotateCcw aria-hidden="true" />} onPress={onReopen}>
                        {phase === 'ended' ? t('Reopen class') : t('Keep it running')}
                    </Button>
                </div>
            ) : (
                <div className="hubEndForm">
                    <div className="hubDangerRow">
                        <span className="hubDangerIcon" aria-hidden="true">
                            <LuFlag />
                        </span>
                        <div>
                            <strong>{t('End this class')}</strong>
                            <p className="hubHint">{t('Its history stays: sessions, roll calls, routines, invoices. You can reopen it later.')}</p>
                        </div>
                    </div>
                    <div className="hubField">
                        <span className="hubFieldLabel">{t('Last day')}</span>
                        <Segmented
                            label={t('Last day')}
                            options={[
                                { key: 'today', label: t('Today') },
                                { key: 'month', label: t('End of this month') },
                                { key: 'custom', label: t('Another day') },
                            ]}
                            value={choice}
                            onChange={setChoice}
                        />
                    </div>
                    <AnimatePresence initial={false}>
                        {choice === 'custom' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <DateField label={t('Last day')} value={custom} onChange={setCustom} isInvalid={Boolean(lastDayError)} errorMessage={lastDayError || undefined} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <Input label={t('Reason')} placeholder={t('Optional, e.g. Summer camp is over')} value={reason} onValueChange={setReason} maxLength={200} />
                    <div className="hubFormActions">
                        <span className="hubHint">{lastDay ? t('Last session on or before {date}.', { date: formatDate(lastDay, 'long') }) : ''}</span>
                        <Button color="danger" variant="flat" isLoading={saving} isDisabled={!canEnd} startContent={saving ? null : <LuFlag aria-hidden="true" />} onPress={end}>
                            {t('End class')}
                        </Button>
                    </div>
                </div>
            )}

            {paidAfter && paidAfter.length > 0 && (
                <div className="hubPaidAfter" role="status">
                    <strong>{t('These students already paid for a course that won’t run:')}</strong>
                    <ul>
                        {paidAfter.map((row) => (
                            <li key={row.invoice_id}>
                                <span>
                                    <strong>{row.student_name}</strong>
                                    <small>
                                        {row.lesson_title || formatDate(row.month, 'monthYear')} · {formatVnd(row.paid_amount)}
                                    </small>
                                </span>
                                <Button size="sm" variant="flat" startContent={<LuArrowRightLeft aria-hidden="true" />} onPress={() => setSwitching(row)}>
                                    {t('Switch class')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                    <p className="hubHint">{t('Switching moves their money to the new class. Otherwise refund them and note it on their invoice.')}</p>
                </div>
            )}

            {switching && (
                <SwitchClassDialog
                    student={{ id: switching.student_id, name: switching.student_name }}
                    fromClass={{ id: cls.id, name: cls.name }}
                    onClose={() => setSwitching(null)}
                    onSwitched={() => {
                        setPaidAfter((old) => old.filter((row) => row.student_id !== switching.student_id));
                        setSwitching(null);
                        onChanged();
                    }}
                />
            )}
        </div>
    );
};

export default EndClassPanel;
