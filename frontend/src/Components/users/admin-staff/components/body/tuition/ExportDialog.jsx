import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight, LuDownload } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listInvoices } from '@/services/tuition';
import { nextMonth, prevMonth } from '@/lib/lessons';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../common/Segmented';
import { capitalizeFirst, downloadCsv, withCourses } from './tuitionModel';

// The accountant's CSV: the courses running now (and finished ones still owed), the next courses, or
// every course starting in a month (the month reports count it in).
const ExportDialog = ({ sets, thisMonth, today, progressById, onClose }) => {
    const { t, tn, monthName } = useI18n();
    const [kind, setKind] = useState('running');
    const [month, setMonth] = useState(thisMonth);
    const monthly = useAsync(() => (kind === 'month' ? listInvoices(month) : Promise.resolve(undefined)), [kind, month]);
    const rows = kind === 'month' ? (monthly.data ? withCourses(monthly.data, progressById, today) : null) : sets[kind];
    const loading = kind === 'month' && monthly.loading;
    const monthLabel = capitalizeFirst(monthName(month, { withYear: true }));
    const options = [
        { key: 'running', label: t('Running courses') },
        { key: 'next', label: t('Next courses') },
        { key: 'month', label: t('A month') },
    ];

    const download = () => {
        downloadCsv(rows ?? [], kind === 'month' ? month.slice(0, 7) : `${kind}-${today}`, today, t);
        onClose();
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'tuDialog tuExportDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader>{t('Export CSV')}</ModalHeader>
                <ModalBody className="tuDialogBody">
                    <Segmented label={t('Which invoices')} options={options} value={kind} onChange={setKind} className="tuExportKinds" />
                    {kind === 'month' && (
                        <div className="tuMonthNav" role="group" aria-label={t('Month')}>
                            <button type="button" aria-label={t('Previous month')} onClick={() => setMonth(prevMonth(month))}>
                                <LuChevronLeft />
                            </button>
                            <span className="tuMonthName">
                                <strong>{monthLabel}</strong>
                                <small>{month === thisMonth ? t('This month') : t('Courses starting then')}</small>
                            </span>
                            <button type="button" aria-label={t('Next month')} disabled={month > thisMonth} onClick={() => setMonth(nextMonth(month))}>
                                <LuChevronRight />
                            </button>
                        </div>
                    )}
                    <p className="tuDialogText">
                        {
                            {
                                running: t('Courses running now, and finished courses still unpaid.'),
                                next: t('The next course of each class: renewals that are open, to pay or answer.'),
                                month: t('Courses that start in {month}, the month reports count them in.', { month: monthLabel }),
                            }[kind]
                        }{' '}
                        <strong>{loading ? '…' : tn(rows?.length ?? 0, '{count} invoice', '{count} invoices')}</strong>
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button color="danger" startContent={<LuDownload aria-hidden="true" />} isDisabled={loading || !rows?.length} onPress={download}>
                        {t('Download CSV')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ExportDialog;
