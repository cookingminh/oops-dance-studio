import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Spinner, Textarea } from '@nextui-org/react';
import { LuArrowRightLeft, LuBarChart3 } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { loadSwitchOptions } from '@/services/classSwitch';
import { amountDue, switchClass } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { EASE_OUT } from '../motion';
import ClassChoice from './ClassChoice';
import MoneyPreview from './MoneyPreview';
import { runningCourse, switchPreview } from './switchModel';

const reveal = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: EASE_OUT } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.18 } },
};

// The body of "Switch class", shared by the dialog (Students page, Tuition page, class page) and the
// person panel (inline). `Body` / `Footer` are the wrappers to render into (ModalBody / ModalFooter,
// or plain divs). `student` { id, name }, `fromClass` { id, name }. onSwitched(newInvoice, toClass).
// No switch in the middle of a course: they finish the one they're in and join the new class from
// its next course (switchModel explains the rule).
const SwitchClassForm = ({ student, fromClass, Body = 'div', Footer = 'div', onCancel, onSwitched }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const options = useAsync(() => loadSwitchOptions(student.id), [student.id]);
    const [toId, setToId] = useState(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const previewRef = useRef(null);

    const data = options.data;
    const from = data?.classes.find((cls) => cls.id === fromClass.id) ?? { ...fromClass, price: null, lessons: [] };
    const choices = data ? data.classes.filter((cls) => !data.enrolledIds.has(cls.id)) : [];
    const to = choices.find((cls) => cls.id === toId) ?? null;
    const place = data?.enrolments.get(fromClass.id);
    const stillIn = data ? Boolean(place) : true;
    const fromRunning = data ? Boolean(runningCourse(from, data.progress)) : false;
    const preview = to && data
        ? switchPreview({ invoices: data.invoices, fromClass: from, toClass: to, today: data.today, settings: data.settings, progress: data.progress })
        : null;

    // The preview opens under the cards: bring it into view (it may be below the fold on a phone).
    useEffect(() => {
        if (!toId) return undefined;
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = setTimeout(() => previewRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' }), 320);
        return () => clearTimeout(timer);
    }, [toId]);

    const submit = async () => {
        if (!to || saving) return;
        setSaving(true);
        try {
            const invoice = await switchClass(student.id, fromClass.id, to.id, note.trim() || null);
            const left = invoice && invoice.status === 'unpaid' ? amountDue(invoice) : 0;
            const vars = { name: student.name, className: to.name, course: invoice?.lesson_title || preview?.target?.title || '', amount: formatVnd(left) };
            toast.success(left > 0 ? t('{name} joins {className} from {course}: {amount} to pay.', vars) : t('{name} joins {className} from {course}.', vars));
            onSwitched?.(invoice, to);
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    let content;
    if (options.error) content = <ErrorMessage error={options.error} onRetry={options.reload} />;
    else if (!data)
        content = (
            <div className="swLoading">
                <Spinner size="sm" color="danger" />
                <span>{t('Loading classes…')}</span>
            </div>
        );
    else if (!stillIn) content = <p className="swEmpty">{t('{name} isn’t in {className} any more.', { name: student.name, className: fromClass.name })}</p>;
    else if (place?.leaves_after)
        content = (
            <p className="swEmpty">
                {t('{name} already leaves {className} after {date}: a switch is planned.', { name: student.name, className: fromClass.name, date: formatDate(place.leaves_after, 'short') })}
            </p>
        );
    else if (choices.length === 0) content = <p className="swEmpty">{t('{name} is already in every other class.', { name: student.name })}</p>;
    else
        content = (
            <>
                <ClassChoice classes={choices} fromPrice={from.price} value={toId} onChange={setToId} progress={data.progress} today={data.today} fromRunning={fromRunning} />
                <AnimatePresence initial={false}>
                    {preview && (
                        <motion.div key="preview" className="swReveal" ref={previewRef} {...reveal}>
                            <MoneyPreview preview={preview} settings={data.settings} studentName={student.name} fromName={fromClass.name} toClass={to} />
                            {!preview.blocked && (
                                <Textarea
                                    label={t('Note (optional)')}
                                    placeholder={t('Why they’re switching, e.g. wants a more advanced class')}
                                    value={note}
                                    onValueChange={setNote}
                                    maxLength={200}
                                    minRows={2}
                                    className="swNote"
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
                <p className="swNotChurn">
                    <LuBarChart3 aria-hidden="true" />
                    <span>{t('Not counted as leaving: reports show it as a class switch.')}</span>
                </p>
            </>
        );

    return (
        <>
            <Body className="swBody">{content}</Body>
            <Footer className="swFoot">
                <span className="swFootButtons">
                    <Button variant="light" onPress={onCancel} isDisabled={saving}>
                        {t('Cancel')}
                    </Button>
                    <Button
                        color="danger"
                        onPress={submit}
                        isDisabled={!to || !stillIn || Boolean(place?.leaves_after) || Boolean(preview?.blocked)}
                        isLoading={saving}
                        startContent={saving ? null : <LuArrowRightLeft aria-hidden="true" />}
                    >
                        {to ? t('Switch to {className}', { className: to.name }) : t('Switch class')}
                    </Button>
                </span>
            </Footer>
        </>
    );
};

export default SwitchClassForm;
