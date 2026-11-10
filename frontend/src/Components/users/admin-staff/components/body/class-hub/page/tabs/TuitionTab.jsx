import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuCalendarPlus, LuReceipt, LuRepeat } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import {
    getTuitionSettings,
    isPaymentSandbox,
    markPaid,
    openCourse,
    reopenInvoice,
    setInvoiceAmount,
    setInvoiceNote,
    setRenewal,
    simulateTransfer,
    undoPayment,
    waiveInvoice,
} from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../../common/SectionCard';
import { stagger } from '../../../../common/motion';
import SwitchClassDialog from '../../../../common/switch-class/SwitchClassDialog';
import InvoiceRow from '../../../tuition/InvoiceRow';
import PaymentDialog from '../../../tuition/PaymentDialog';
import AdjustDialog from '../../../tuition/AdjustDialog';
import PaymentCodeDialog from '../../../tuition/PaymentCodeDialog';
import NoteDialog from '../../../tuition/NoteDialog';
import { withCourses } from '../../../tuition/tuitionModel';
import { routineNow } from '../../hubModel';
import { useClassInvoices } from '../useClassActivity';
import { defaultCourseKey, groupByCourse } from '../tuition/courseModel';
import CourseHead from '../tuition/CourseHead';
import CoursePicker from '../tuition/CoursePicker';
import RenewalPanel from '../tuition/RenewalPanel';
import '../../../tuition/tuition.scss';
import '../tuition/hubTuition.scss';

// Tuition: the next course's renewal in plain words (who continues, stops or hasn't answered), then
// this class's invoices course by course (a course = a routine; pick one in the dropdown, kept in the
// URL as ?course=<lesson id>), with the same row actions as /admin/tuition. A thin view over the
// tuition services.
const TuitionTab = ({ ctx }) => {
    const { cls, today, progress, version, changed, params, setTab } = ctx;
    const { t, tn } = useI18n();
    const toast = useToast();
    const [local, setLocal] = useState(0);
    const invoices = useClassInvoices(cls.id, `${version}-${local}`);
    const settings = useAsync(getTuitionSettings, []);
    const sandbox = useAsync(() => isPaymentSandbox().catch(() => false), []);
    const [busyId, setBusyId] = useState(null);
    const [dialog, setDialog] = useState(null); // { kind, invoice }

    // Rows carry their course's phase (open or finished), which decides the actions InvoiceRow offers.
    const rows = withCourses(invoices.data ?? [], new Map(progress.map((row) => [row.lesson_id, row])), today);
    const groups = groupByCourse(progress, rows, today);
    const { current, planned } = routineNow(progress);
    const asked = params?.get('course');
    const selected = groups.find((group) => group.key === asked) ?? groups.find((group) => group.key === defaultCourseKey(groups));
    const next = planned && (current || !(cls.starts_on && cls.starts_on > today)) ? groups.find((group) => group.key === String(planned.lesson_id)) : null;
    const pickCourse = (key) => setTab('tuition', { course: key });
    // Each student's place in the class now (joining from a later course, leaving after this one).
    const places = new Map((cls.students ?? []).map((row) => [row.student?.id, { joined_at: row.joined_at, leaves_after: row.leaves_after }]));

    const refresh = () => {
        setLocal((value) => value + 1);
        changed();
    };

    // Runs one write; true when it worked (dialogs close then).
    const run = async (id, action, message) => {
        setBusyId(id);
        try {
            const result = await action();
            const text = typeof message === 'function' ? message(result) : message;
            if (text) toast.success(text);
            refresh();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const course = (invoice) => invoice.lesson_title || invoice.course?.title || cls.name;

    const answer = (invoice, decision) => {
        const running = current && invoice.lesson_id === current.lesson_id;
        if (decision === 'stop' && running && !window.confirm(t('{name} stops “{course}” now and leaves the class today. Continue?', { name: invoice.student_name, course: course(invoice) }))) return;
        run(invoice.id, () => setRenewal(invoice.id, decision),
            decision === 'continue'
                ? t('{name} continues with “{course}”.', { name: invoice.student_name, course: course(invoice) })
                : t('{name} stops at “{course}”.', { name: invoice.student_name, course: course(invoice) }));
    };

    const onAction = (kind, invoice) => {
        switch (kind) {
            case 'pay':
            case 'code':
            case 'switch':
            case 'amount':
            case 'waive':
            case 'note':
                setDialog({ kind, invoice });
                break;
            case 'undo':
                if (!window.confirm(t('Undo the {amount} payment from {name}? Transfers that paid it go back to the inbox.', { amount: formatVnd(invoice.paid_amount), name: invoice.student_name }))) return;
                run(invoice.id, () => undoPayment(invoice.id), t('Payment undone.'));
                break;
            case 'reopen':
                run(invoice.id, () => reopenInvoice(invoice.id), t('Invoice reopened.'));
                break;
            case 'continue':
            case 'stop':
                answer(invoice, kind);
                break;
            default:
        }
    };

    const openRenewal = (group) => {
        if (!window.confirm(t('Open the renewal of “{title}” now? Everyone in the class gets an invoice for it and can pay or answer straight away.', { title: group.course.title }))) return;
        run(`open-${group.key}`, () => openCourse(group.course.lesson_id), (count) => tn(count ?? 0, '{count} student billed for “{title}”.', '{count} students billed for “{title}”.', { title: group.course.title }));
    };

    const close = () => setDialog(null);
    const rowProps = { invoices: rows, today, places, busyId, onAction };

    return (
        <>
            {next && (
                <RenewalPanel cls={cls} current={current} next={next} settings={settings.data} rowProps={rowProps} busy={busyId === `open-${next.key}`} onOpen={() => openRenewal(next)} />
            )}
            {current && !planned && !cls.ended_on && (
                <SectionCard icon={LuRepeat} title={t('Next course')} className="hubRenewal">
                    <div className="hubNextEmpty">
                        <p className="hubNextSentence">
                            {tn(settings.data?.renewal_open_sessions ?? 2, 'No next course is planned yet. Plan it in Routines: its renewal then opens by itself when {count} session is left.', 'No next course is planned yet. Plan it in Routines: its renewal then opens by itself when {count} sessions are left.')}
                        </p>
                        <Button variant="flat" startContent={<LuCalendarPlus aria-hidden="true" />} onPress={() => setTab('routines')}>
                            {t('Plan the next course')}
                        </Button>
                    </div>
                </SectionCard>
            )}

            <SectionCard
                icon={LuReceipt}
                title={t('Tuition by course')}
                subtitle={t('One invoice per student and course. Joining late pays only for the sessions left.')}
                className="hubTuition"
            >
                <AsyncState state={invoices} isEmpty={groups.length === 0} emptyText="No courses yet. Plan a routine in Routines: it is the course students pay for.">
                    {selected && (
                        <>
                            <div className="hubCourseBar">
                                <CoursePicker groups={groups} value={selected.key} onChange={pickCourse} />
                                <CourseHead group={selected} />
                            </div>
                            {selected.invoices.length === 0 ? (
                                <div className="hubEmptyBlock">
                                    <p>
                                        {selected.course?.status === 'planned'
                                            ? t('Nobody pays for this course yet: its renewal isn’t open.')
                                            : t('Nobody paid for this course.')}
                                    </p>
                                    {selected.course?.status === 'planned' && !next && (cls.students ?? []).length > 0 && (
                                        <button type="button" className="hubLink" onClick={() => openRenewal(selected)}>
                                            {t('Open renewal now')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <motion.ul key={selected.key} className="tuRows hubInvoiceList" variants={stagger} initial="hidden" animate="show">
                                    {selected.invoices.map((invoice) => (
                                        <InvoiceRow
                                            key={invoice.id}
                                            invoice={invoice}
                                            invoices={rows}
                                            today={today}
                                            place={places.get(invoice.student_id) ?? null}
                                            busy={busyId === invoice.id}
                                            onAction={onAction}
                                        />
                                    ))}
                                </motion.ul>
                            )}
                        </>
                    )}
                </AsyncState>
            </SectionCard>

            {dialog?.kind === 'pay' && (
                <PaymentDialog
                    invoice={dialog.invoice}
                    onClose={close}
                    onSubmit={(payment) => run(dialog.invoice.id, () => markPaid(dialog.invoice.id, payment), t('Payment recorded for {name}.', { name: dialog.invoice.student_name }))}
                />
            )}
            {(dialog?.kind === 'waive' || dialog?.kind === 'amount') && (
                <AdjustDialog
                    invoice={dialog.invoice}
                    mode={dialog.kind}
                    onClose={close}
                    onSubmit={({ amount, note }) =>
                        dialog.kind === 'waive'
                            ? run(dialog.invoice.id, () => waiveInvoice(dialog.invoice.id, note), t('“{course}” waived for {name}.', { course: course(dialog.invoice), name: dialog.invoice.student_name }))
                            : run(dialog.invoice.id, () => setInvoiceAmount(dialog.invoice.id, amount, note), t('Amount changed to {amount}.', { amount: formatVnd(amount) }))
                    }
                />
            )}
            {dialog?.kind === 'note' && (
                <NoteDialog
                    invoice={dialog.invoice}
                    onClose={close}
                    onSubmit={(note) => run(dialog.invoice.id, () => setInvoiceNote(dialog.invoice.id, note), note ? t('Note saved.') : t('Note removed.'))}
                />
            )}
            {dialog?.kind === 'code' && (
                <PaymentCodeDialog
                    invoice={dialog.invoice}
                    settings={settings.data}
                    sandbox={Boolean(sandbox.data)}
                    onClose={close}
                    onSimulate={() => run(dialog.invoice.id, () => simulateTransfer(dialog.invoice.id), t('Transfer received: {name} has paid.', { name: dialog.invoice.student_name }))}
                />
            )}
            {dialog?.kind === 'switch' && (
                <SwitchClassDialog
                    student={{
                        id: dialog.invoice.student_id,
                        name: dialog.invoice.student_name,
                        avatar_path: dialog.invoice.student?.avatar_path,
                        updated_at: dialog.invoice.student?.updated_at,
                    }}
                    fromClass={{ id: cls.id, name: cls.name }}
                    onClose={close}
                    onSwitched={() => {
                        close();
                        refresh();
                    }}
                />
            )}
        </>
    );

};

export default TuitionTab;
