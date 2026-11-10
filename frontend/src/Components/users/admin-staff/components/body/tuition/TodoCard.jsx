import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuAlertCircle, LuCalendarClock, LuChevronDown, LuCoffee, LuHistory, LuLandmark, LuListTodo } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import { stagger } from '../../common/motion';
import { DUE_SOON_DAYS, peopleOn } from './tuitionModel';
import InvoiceRow from './InvoiceRow';
import { UnmatchedTransfers } from './TransferInbox';

const reveal = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.25 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.18 } },
};

const sumDue = (invoices) => invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)), 0);

// Rows of invoices from any class (class · course on each row, quick actions).
const Rows = ({ invoices, list, today, enrolments, busyId, onAction }) => (
    <motion.ul className="tuRows" variants={stagger} initial="hidden" animate="show">
        {list.map((invoice) => (
            <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                invoices={invoices}
                today={today}
                place={enrolments?.get(`${invoice.class_id}:${invoice.student_id}`) ?? null}
                busy={busyId === invoice.id}
                onAction={onAction}
                showClass
                quick
            />
        ))}
    </motion.ul>
);

// A group's heading: icon, name, count and a line about it.
const GroupHead = ({ id, icon: Icon, title, count, hint, children }) => (
    <div className="tuTodoHead">
        <span className="tuTodoIcon" aria-hidden="true">
            <Icon />
        </span>
        <span className="tuTodoTitles">
            <h3 id={id}>
                {title} <span className="segCount">{count}</span>
            </h3>
            {hint && <small>{hint}</small>}
        </span>
        {children}
    </div>
);

// "To do": one action list across every class, most urgent first — who is late, the bank transfers
// nobody has sorted yet, then (folded) what falls due this week. Each row keeps its own actions.
const TodoCard = ({ state, lists, invoices, transfers, today, enrolments, busyId, onAction, onHistory, transferProps }) => {
    const { t, tn } = useI18n();
    const [showSoon, setShowSoon] = useState(false);
    const { late, soon } = lists;
    const clear = late.length === 0 && transfers.length === 0;
    const rowProps = { invoices, today, enrolments, busyId, onAction };

    return (
        <SectionCard
            id="tuition-todo"
            className="tuTodoCard"
            icon={LuListTodo}
            title={t('To do')}
            subtitle={clear ? t('Everything across the classes that needs collecting or sorting.') : t('Across every class, most urgent first.')}
            actions={
                <Button variant="light" startContent={<LuHistory aria-hidden="true" />} onPress={onHistory}>
                    {t('Transfer history')}
                </Button>
            }
        >
            <AsyncState state={state} isEmpty={false}>
                {clear && (
                    <div className="tuCalm">
                        <span aria-hidden="true">
                            <LuCoffee />
                        </span>
                        <strong>{t('Nothing to collect right now')}</strong>
                        <small>{t('Nobody is late and every bank transfer is sorted.')}</small>
                    </div>
                )}

                {late.length > 0 && (
                    <section id="tuition-late" className="tuTodoGroup isLate" aria-labelledby="tu-late-title">
                        <GroupHead
                            id="tu-late-title"
                            icon={LuAlertCircle}
                            title={t('Late')}
                            count={late.length}
                            hint={tn(peopleOn(late), '{count} person past the due date · {amount} to collect', '{count} people past the due date · {amount} to collect', { amount: formatVnd(sumDue(late)) })}
                        />
                        <Rows list={late} {...rowProps} />
                    </section>
                )}

                {transfers.length > 0 && (
                    <section id="tuition-transfers" className="tuTodoGroup isTransfers" aria-labelledby="tu-transfers-title">
                        <GroupHead
                            id="tu-transfers-title"
                            icon={LuLandmark}
                            title={t('Transfers to sort')}
                            count={transfers.length}
                            hint={t('Money that came in without a usable invoice code: put it on an invoice or a room booking, or set it aside.')}
                        />
                        <UnmatchedTransfers transfers={transfers} {...transferProps} />
                    </section>
                )}

                {soon.length > 0 && (
                    <section id="tuition-soon" className="tuTodoGroup isSoon" aria-labelledby="tu-soon-title">
                        <GroupHead
                            id="tu-soon-title"
                            icon={LuCalendarClock}
                            title={t('Due soon')}
                            count={soon.length}
                            hint={tn(DUE_SOON_DAYS, 'Not paid yet, due within {count} day · {amount}', 'Not paid yet, due within {count} days · {amount}', { amount: formatVnd(sumDue(soon)) })}
                        >
                            <Button
                                size="sm"
                                variant="flat"
                                className="tuSoonToggle"
                                aria-expanded={showSoon}
                                aria-controls="tu-soon-list"
                                endContent={<LuChevronDown aria-hidden="true" className={showSoon ? 'isOpen' : ''} />}
                                onPress={() => setShowSoon((value) => !value)}
                            >
                                {showSoon ? t('Hide') : t('Show')}
                            </Button>
                        </GroupHead>
                        <AnimatePresence initial={false}>
                            {showSoon && (
                                <motion.div key="soon" id="tu-soon-list" className="tuReveal" {...reveal}>
                                    <Rows list={soon} {...rowProps} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default TodoCard;
