import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@nextui-org/react';
import { LuExternalLink, LuFileText } from 'react-icons/lu';
import { receiptUrl } from '@/services/expenses';
import { formatVnd } from '@/lib/format';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { isPdfPath } from './expensesModel';

// A receipt from the private bucket through a fresh signed link: photos show here, PDFs open
// in a new tab (browsers show them better than a dialog can).
const ReceiptViewer = ({ expense, onClose }) => {
    const { t, formatDate } = useI18n();
    const link = useAsync(() => receiptUrl(expense.receipt_path), [expense.receipt_path]);
    const pdf = isPdfPath(expense.receipt_path);

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" size={pdf ? 'md' : '2xl'} scrollBehavior="inside" classNames={{ base: 'exDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="exDialogHeader">
                    <span className="exDialogKicker">{t('Receipt')}</span>
                    <span className="exDialogTitle">{expense.description}</span>
                    <small className="exDialogSub">{`${formatVnd(expense.amount)} · ${formatDate(expense.spent_on, 'shortYear')}`}</small>
                </ModalHeader>
                <ModalBody className="exViewerBody">
                    {link.error ? (
                        <ErrorMessage error={link.error} onRetry={link.reload} />
                    ) : !link.data ? (
                        <Spinner color="danger" label={t('Loading…')} />
                    ) : pdf ? (
                        <div className="exPdfCard">
                            <LuFileText aria-hidden="true" />
                            <span>{t('This receipt is a PDF.')}</span>
                        </div>
                    ) : (
                        <img className="exViewerImage" src={link.data} alt={t('Receipt for {name}', { name: expense.description })} />
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {t('Close')}
                    </Button>
                    {link.data && (
                        <Button as="a" href={link.data} target="_blank" rel="noreferrer" color={pdf ? 'danger' : 'default'} variant={pdf ? 'solid' : 'flat'} startContent={<LuExternalLink aria-hidden="true" />}>
                            {pdf ? t('Open PDF') : t('Open full size')}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ReceiptViewer;
