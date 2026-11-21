import { Button, Modal, ModalBody, ModalContent, ModalFooter } from '@nextui-org/react';
import { LuPrinter } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { formatClock, formatVnd } from '@/lib/format';
import { amountDue } from '@/services/tuition';
import { ADDRESS, EMAIL, PHONE } from '@/Components/HomePage/Components/NavBar/contactInfo';
import { capitalizeFirst } from '../../../../../admin-staff/components/body/tuition/tuitionModel';
import { statusOf, studioDay } from '../tuition/tuitionData';
import { useShortDay } from './pastClassesData';
import '@/ui/payment/receipt.scss';

const STUDIO = 'Oops! Dance Studio';

// A printable receipt (hoá đơn) for one course's tuition, from "Classes you've taken": the studio, the
// student, the course (class, song, period, sessions, teacher), the fee and what was paid, how and when.
// Same paper as the room bookings' receipt (ui/payment/BookingReceipt.jsx, receipt.scss: Print prints
// only the receipt). `row` is a pastClassesData.js row; `today` = 'yyyy-MM-dd'.
const CourseReceipt = ({ row, today, onClose }) => {
    const { user } = useAuth();
    const { t, tn, formatDate, monthName } = useI18n();
    const shortDay = useShortDay();
    const { invoice } = row;
    const status = statusOf(invoice, today);
    const amount = Number(invoice.amount);
    const paid = Number(invoice.paid_amount);
    // A waived or cancelled course costs what was paid on it (nothing, or what stayed for the sessions danced).
    const settled = ['waived', 'void'].includes(invoice.status);
    const total = settled ? paid : amount;
    const left = invoice.status === 'unpaid' ? amountDue(invoice) : 0;
    const method = invoice.method === 'cash' ? t('Cash') : t('Bank transfer');
    const paidDay = studioDay(invoice.paid_at);
    const period = [capitalizeFirst(monthName(row.month, { withYear: true })), row.startsOn && `${shortDay(row.startsOn)} – ${row.endsOn ? shortDay(row.endsOn) : '…'}`]
        .filter(Boolean)
        .join(' · ');
    const sessions = row.total != null ? tn(row.total, '{count} session', '{count} sessions') : null;
    const lateJoin = invoice.sessions != null && row.total != null && Number(invoice.sessions) < Number(row.total);

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="2xl"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'bkReceiptModal adminPortal' }}
        >
            <ModalContent>
                <ModalBody className="bkReceiptBody">
                    <article className="bkReceipt" aria-label={t('Receipt for {code}', { code: invoice.payment_code })}>
                        <header className="bkReceiptHead">
                            <div>
                                <strong className="bkStudio">{STUDIO}</strong>
                                <span>{ADDRESS}</span>
                                <span>
                                    {PHONE.display} · {EMAIL}
                                </span>
                            </div>
                            <div className="bkReceiptTitle">
                                <h2>{t('Receipt')}</h2>
                                <span>{t('Payment code')}</span>
                                <span className="bkMono">{invoice.payment_code}</span>
                                {today && <span>{t('Issued {date}', { date: formatDate(today, 'shortYear') })}</span>}
                            </div>
                        </header>

                        <section className="bkReceiptParties">
                            <div>
                                <h3>{t('Billed to')}</h3>
                                <strong>{invoice.student_name || user?.full_name || user?.username}</strong>
                                {user?.contact_number && <span>{user.contact_number}</span>}
                                {user?.email && <span>{user.email}</span>}
                            </div>
                            <div>
                                <h3>{t('Course details')}</h3>
                                <strong>{row.className}</strong>
                                {row.song && <span>{[row.song, row.artist].filter(Boolean).join(' — ')}</span>}
                                <span>{period}</span>
                                {(sessions || row.teacher) && (
                                    <span>
                                        {[sessions, row.teacher && `${t('with')} ${row.teacher.name}`].filter(Boolean).join(' · ')}
                                    </span>
                                )}
                            </div>
                        </section>

                        <table className="bkReceiptLines">
                            <thead>
                                <tr>
                                    <th scope="col">{t('Item')}</th>
                                    <th scope="col">{t('Amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        {t('Tuition · {course}', { course: row.song || row.className })}
                                        <small>
                                            {[row.className, lateJoin ? t('Joined late · paid for {left} of {count}', { left: invoice.sessions, count: row.total }) : sessions]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </small>
                                    </td>
                                    <td>{formatVnd(amount)}</td>
                                </tr>
                                {settled && amount !== total && (
                                    <tr className="bkChange">
                                        <td>{t(status.key)}</td>
                                        <td>−{formatVnd(amount - total)}</td>
                                    </tr>
                                )}
                                <tr className="isTotal">
                                    <th scope="row">{t('Total')}</th>
                                    <td>{formatVnd(total)}</td>
                                </tr>
                            </tbody>
                            <tbody>
                                <tr className="isGroup">
                                    <th scope="rowgroup" colSpan={2}>
                                        {t('Payments')}
                                    </th>
                                </tr>
                                {paid > 0 ? (
                                    <tr>
                                        <td>
                                            {[paidDay && `${formatDate(paidDay, 'short')} ${formatClock(invoice.paid_at)}`, invoice.method && method].filter(Boolean).join(' · ')}
                                            {invoice.method === 'transfer' && <small className="bkMono">{invoice.payment_code}</small>}
                                        </td>
                                        <td>{formatVnd(paid)}</td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="bkNone">
                                            {t('No payments yet')}
                                        </td>
                                    </tr>
                                )}
                                <tr className="isTotal">
                                    <th scope="row">{t('Paid so far')}</th>
                                    <td>{formatVnd(paid)}</td>
                                </tr>
                                <tr className={`isTotal isBalance${left ? ' isDue' : ''}`}>
                                    <th scope="row">{t('Balance due')}</th>
                                    <td>{formatVnd(left)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <footer className="bkReceiptFoot">
                            <p>
                                {t('Status')}: <strong>{t(status.key, status.vars && { date: formatDate(status.vars.date, 'dayMonth') })}</strong>
                            </p>
                            {left > 0 && <p>{t('Pay {amount} by transfer with {code} in the content, or at the studio desk.', { amount: formatVnd(left), code: invoice.payment_code })}</p>}
                            <p className="bkThanks">{t('Thank you for dancing with us!')}</p>
                        </footer>
                    </article>
                </ModalBody>
                <ModalFooter className="bkReceiptActions">
                    <Button variant="light" onPress={onClose}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" startContent={<LuPrinter aria-hidden="true" />} onPress={() => window.print()}>
                        {t('Print')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CourseReceipt;
