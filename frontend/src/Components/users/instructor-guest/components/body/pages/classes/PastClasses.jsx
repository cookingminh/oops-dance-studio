import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuHistory, LuWallet } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { formatVnd } from '@/lib/format';
import { forgetMyTuition } from '@/services/tuitionStudent';
import Segmented from '../../../../../admin-staff/components/common/Segmented';
import { capitalizeFirst } from '../../../../../admin-staff/components/body/tuition/tuitionModel';
import { classHue } from '../../profileHelpers';
import PayDialog from '../tuition/PayDialog';
import CourseReceipt from './CourseReceipt';
import { CourseRow, PastEmpty, PastSkeleton } from './PastParts';
import { groupByMonth, loadPastClasses } from './pastClassesData';
import '../tuition/tuition.scss';
import './pastClassesDialog.scss';

// "Classes you've taken" (My classes, students): every course they have danced or are dancing, in the
// classes they're in, left or that ended, newest month first. Each shows the class, the song, the
// teacher, when it ran and its tuition: the receipt, Pay while it's open (the tuition page's QR dialog)
// and the class video. Chips narrow it to one class. `onPaid` tells the page a course was just paid.
const PastClasses = ({ onClose, onPaid }) => {
    const { user } = useAuth();
    const { t, tn, monthName } = useI18n();
    const data = useAsync(() => loadPastClasses(user.id), [user.id]);
    const [filter, setFilter] = useState('all');
    const [receipt, setReceipt] = useState(null); // row whose receipt is open
    const [paying, setPaying] = useState(null); // invoice in the pay dialog

    const past = data.data;
    const active = past?.classes.some((cls) => cls.key === filter) ? filter : 'all';
    const rows = past ? past.rows.filter((row) => active === 'all' || row.classKey === active) : [];
    const paidTotal = rows.reduce((sum, row) => sum + Number(row.invoice.paid_amount), 0);

    const refresh = () => {
        forgetMyTuition();
        return data.reload();
    };

    let body;
    if (data.error && !past) body = <ErrorMessage error={data.error} onRetry={data.reload} />;
    else if (!past) body = <PastSkeleton />;
    else if (!past.rows.length) body = <PastEmpty />;
    else {
        body = groupByMonth(rows).map((group) => {
            const label = capitalizeFirst(monthName(group.month, { withYear: true }));
            return (
                <section key={group.month} className="pcMonth" aria-label={label}>
                    <h3 className="pcMonthHead">
                        <span>{label}</span>
                        <small>{tn(group.rows.length, '{count} course', '{count} courses')}</small>
                    </h3>
                    <ul className="pcList">
                        {group.rows.map((row) => (
                            <CourseRow key={row.id} row={row} today={past.today} all={past.all} onReceipt={setReceipt} onPay={setPaying} />
                        ))}
                    </ul>
                </section>
            );
        });
    }

    return (
        <>
            <Modal
                isOpen
                onOpenChange={(open) => !open && onClose()}
                size="4xl"
                placement="center"
                scrollBehavior="inside"
                classNames={{ base: 'pcModal adminPortal', closeButton: 'pcClose' }}
            >
                <ModalContent>
                    <ModalHeader className="pcHead">
                        <span className="pcHeadIcon" aria-hidden="true">
                            <LuHistory />
                        </span>
                        <span className="pcHeadText">
                            <span className="pcTitle">{t('Classes you’ve taken')}</span>
                            <span className="pcSub">
                                {past?.rows.length
                                    ? tn(rows.length, '{count} course · {amount} paid', '{count} courses · {amount} paid', { amount: formatVnd(paidTotal) })
                                    : t('Every course, its song, teacher and receipt')}
                            </span>
                        </span>
                    </ModalHeader>
                    {past && past.classes.length > 1 && (
                        <div className="pcFilters">
                            <Segmented
                                label={t('Class')}
                                value={active}
                                onChange={setFilter}
                                options={[
                                    { key: 'all', label: t('All classes'), count: past.rows.length },
                                    ...past.classes.map((cls) => ({
                                        key: cls.key,
                                        label: cls.name,
                                        count: cls.count,
                                        color: `hsl(${classHue(cls.id ?? 0)}, 62%, 48%)`,
                                    })),
                                ]}
                            />
                        </div>
                    )}
                    {/* Keyed by the class picked: another class starts at the top. */}
                    <ModalBody key={active} className="pcBody">
                        {body}
                    </ModalBody>
                    <ModalFooter className="pcFootBar">
                        <Link to="/profile/tuition" className="pcTuitionLink">
                            <LuWallet aria-hidden="true" /> {t('See tuition')}
                        </Link>
                        <Button variant="light" onPress={onClose}>
                            {t('Close')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {receipt && <CourseReceipt row={receipt} today={past?.today} onClose={() => setReceipt(null)} />}
            {paying && (
                <PayDialog
                    invoice={paying}
                    settings={past?.settings}
                    sandbox={past?.sandbox}
                    onClose={() => {
                        setPaying(null);
                        refresh();
                    }}
                    onPaid={() => {
                        refresh();
                        onPaid?.();
                    }}
                />
            )}
        </>
    );
};

export default PastClasses;
