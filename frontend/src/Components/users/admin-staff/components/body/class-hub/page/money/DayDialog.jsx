import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuArrowRight, LuPlus } from 'react-icons/lu';
import { attachReceipt, createExpense, updateExpense } from '@/services/expenses';
import { deleteExpenseAndReceipt } from '@/services/expensesExtra';
import { setSessionRoom } from '@/services/classDay';
import { expenseTitle, isAutomaticRent } from '@/lib/expenseCategories';
import { formatClock, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AddCostForm from './AddCostForm';
import DayCostRow from './DayCostRow';
import DaySession from './DaySession';

const signed = (amount) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${formatVnd(Math.abs(amount))}`;

// One day of the class's money, opened from the calendar: its session (and the room it was in at a rented
// studio, changed here for that day only), its costs (edited in place, deleted, added) and the tuition
// received (read only). Every change reloads the month (onChanged): the calendar, the table and the chart.
//   day: moneyDays.monthDays() entry   places: { venues, rooms, ownRooms }   onTuition(): the Tuition tab
const DayDialog = ({ cls, day, today, now, places, showRent, onClose, onChanged, onTuition }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [mode, setMode] = useState('day'); // 'day' | 'add'
    const [busyId, setBusyId] = useState(null);
    const [savingRoom, setSavingRoom] = useState(undefined);
    const { date, session, costs, income } = day;
    const total = day.in - day.out;

    const saveCost = async (row, fields) => {
        setBusyId(row.id);
        try {
            await updateExpense(row.id, fields);
            toast.success(t('Expense saved.'));
            onChanged();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const deleteCost = async (row) => {
        const name = expenseTitle(row, t);
        const question = isAutomaticRent(row)
            ? t('Delete “{name}”? That session’s rent won’t be charged again. If the session didn’t happen, call it off instead: that takes its rent off too.', { name })
            : t('Delete “{name}” ({amount})? This can’t be undone.', { name, amount: formatVnd(row.amount) });
        if (!window.confirm(question)) return;
        setBusyId(row.id);
        try {
            await deleteExpenseAndReceipt(row);
            toast.success(t('Expense deleted.'));
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyId(null);
        }
    };

    // The cost first, then its receipt (the upload needs the id): a receipt that fails leaves the cost added.
    const addCost = async (fields, file) => {
        let row;
        try {
            row = await createExpense({ ...fields, spent_on: date, class_id: cls.id });
        } catch (error) {
            toast.error(error);
            return false;
        }
        try {
            if (file) row = await attachReceipt(row, file);
        } catch (error) {
            toast.error(error);
        }
        toast.success(t('{amount} added.', { amount: formatVnd(row.amount) }));
        setMode('day');
        onChanged();
        return true;
    };

    const moveRoom = async (roomId) => {
        setSavingRoom(roomId);
        try {
            await setSessionRoom(session.row.id, roomId);
            const room = places.rooms.find((item) => item.id === roomId);
            toast.success(room ? t('This session is now in {room}.', { room: room.name }) : t('This session is no longer in a particular room.'));
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setSavingRoom(undefined);
        }
    };

    const title = `${formatDate(date, 'long')} · ${cls.name}`;

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            placement="center"
            size="2xl"
            scrollBehavior="inside"
            isDismissable={busyId === null && savingRoom === undefined}
            classNames={{ base: 'exDialog mcDialog adminPortal' }}
        >
            <ModalContent>
                <ModalHeader className="mcDialogHeader">
                    <span className="mcKicker">{mode === 'add' ? t('New cost on this day') : date === today ? t('Today') : t('Money in and out')}</span>
                    <span className="mcDialogTitle">{title}</span>
                </ModalHeader>

                {mode === 'add' ? (
                    <AddCostForm onSave={addCost} onBack={() => setMode('day')} />
                ) : (
                    <div className="mcDialogMain">
                        <ModalBody className="mcDialogBody">
                            {session && (
                                <section className="mcSection" aria-label={t('Session')}>
                                    <h3 className="mcSectionHead">{t('Session')}</h3>
                                    <ul className="mcSessions">
                                        <DaySession
                                            session={session}
                                            cls={cls}
                                            today={today}
                                            now={now}
                                            places={places}
                                            costs={costs}
                                            showRent={showRent}
                                            saving={savingRoom}
                                            onRoom={moveRoom}
                                        />
                                    </ul>
                                </section>
                            )}

                            <section className="mcSection" aria-label={t('Costs that day')}>
                                <h3 className="mcSectionHead">
                                    <span>{t('Costs that day')}</span>
                                    {day.out > 0 && <span className="mcMoney isOut">−{formatVnd(day.out)}</span>}
                                </h3>
                                {costs.length ? (
                                    <ul className="mcCosts">
                                        {costs.map((row) => (
                                            <DayCostRow key={row.id} row={row} busy={busyId === row.id} onSave={saveCost} onDelete={deleteCost} />
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mcEmpty">{t('No costs on this day.')}</p>
                                )}
                                <Button variant="flat" className="mcAdd" startContent={<LuPlus aria-hidden="true" />} onPress={() => setMode('add')}>
                                    {t('Add a cost')}
                                </Button>
                            </section>

                            <section className="mcSection" aria-label={t('Tuition received')}>
                                <h3 className="mcSectionHead">
                                    <span>{t('Tuition received')}</span>
                                    {day.in > 0 && <span className="mcMoney isIn">+{formatVnd(day.in)}</span>}
                                </h3>
                                {income.length ? (
                                    <ul className="mcIncome">
                                        {income.map((payment) => (
                                            <li key={payment.id}>
                                                <span className="mcCostMain">
                                                    <strong>{payment.student_name || t('A former student')}</strong>
                                                    <small>
                                                        {[payment.lesson_title, payment.method === 'transfer' ? t('Bank transfer') : payment.method === 'cash' ? t('Cash') : null, formatClock(payment.paid_at)]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </small>
                                                </span>
                                                <span className="mcMoney isIn">+{formatVnd(payment.paid_amount)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mcEmpty">{t('No tuition received on this day.')}</p>
                                )}
                                <button type="button" className="exLinkButton mcTuitionLink" onClick={onTuition}>
                                    {t('Open the Tuition tab')}
                                    <LuArrowRight aria-hidden="true" />
                                </button>
                            </section>
                        </ModalBody>
                        <ModalFooter className="mcDialogFooter">
                            <p className="mcDayTotal">
                                <span>{t('Day total (in − out)')}</span>
                                <strong className={total > 0 ? 'isIn' : total < 0 ? 'isOut' : ''}>{signed(total)}</strong>
                            </p>
                            <Button variant="light" onPress={onClose}>
                                {t('Close')}
                            </Button>
                        </ModalFooter>
                    </div>
                )}
            </ModalContent>
        </Modal>
    );
};

export default DayDialog;
