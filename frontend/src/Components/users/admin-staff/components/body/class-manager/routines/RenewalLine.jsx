import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuRepeat } from 'react-icons/lu';
import { openCourse } from '@/services/tuition';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import { renewalCounts } from './routineData';

// The renewal of a planned course: once open (every member billed for it), how many paid, are still
// waiting or are stopping; before that, when it opens by itself and a button to open it now.
// `invoices` null = couldn't be read (shown as nothing). `current` is the running course, if any.
const RenewalLine = ({ routine, invoices, current, opensAt, onOpened, className = '' }) => {
    const toast = useToast();
    const { t, tn } = useI18n();
    const [opening, setOpening] = useState(false);
    if (!invoices) return null;
    const counts = renewalCounts(invoices);

    const open = async () => {
        setOpening(true);
        try {
            const billed = await openCourse(routine.lesson_id);
            toast.success(
                billed > 0
                    ? tn(billed, 'Renewal open: {count} student billed for “{title}”.', 'Renewal open: {count} students billed for “{title}”.', { title: routine.title })
                    : t('Renewal open for “{title}”. Every member already has an invoice.', { title: routine.title })
            );
            onOpened();
        } catch (error) {
            toast.error(error);
        } finally {
            setOpening(false);
        }
    };

    if (counts.open) {
        return (
            <p className={`rtRenewal ${className}`}>
                <LuRepeat aria-hidden="true" />
                <span>
                    <strong>{t('Renewal open')}</strong>
                    <span className="rtCounts">
                        <span className="rtCount is-paid">{tn(counts.paid, '{count} paid', '{count} paid')}</span>
                        <span className="rtCount is-waiting">{tn(counts.waiting, '{count} waiting', '{count} waiting')}</span>
                        <span className="rtCount is-stopping">{tn(counts.stopping, '{count} stopping', '{count} stopping')}</span>
                    </span>
                </span>
            </p>
        );
    }

    return (
        <div className={`rtRenewal ${className}`}>
            <LuRepeat aria-hidden="true" />
            <span>
                <strong>{t('Renewal not open yet.')}</strong>{' '}
                {current
                    ? tn(opensAt, 'It opens by itself when “{title}” has {count} session left.', 'It opens by itself when “{title}” has {count} sessions left.', { title: current.title })
                    : t('It opens by itself with the daily check.')}
            </span>
            <Button size="sm" variant="flat" color="danger" onPress={open} isLoading={opening}>
                {t('Open renewal now')}
            </Button>
        </div>
    );
};

export default RenewalLine;
