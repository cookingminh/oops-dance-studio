import { motion } from 'framer-motion';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@nextui-org/react';
import {
    LuAlertCircle,
    LuBadgeCheck,
    LuCalendarCheck,
    LuCalendarClock,
    LuCalendarX,
    LuClock,
    LuMoreVertical,
    LuPause,
    LuPencil,
    LuPlay,
    LuPlus,
    LuRepeat,
    LuTrash2,
} from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { CategoryIcon, ClassChip } from './ExpenseParts';
import { recurringStatus } from './expensesModel';

const STATUS_ICONS = { added: LuBadgeCheck, due: LuClock, late: LuAlertCircle, paused: LuPause, ended: LuCalendarX, upcoming: LuCalendarClock };

// Where a recurring cost stands this month, in words (+ an icon, so colour isn't the only signal).
const StatusPill = ({ status }) => {
    const { t, formatDate, monthName } = useI18n();
    const Icon = STATUS_ICONS[status.key];
    const text = {
        added: () => t('Added this month'),
        due: () => t('Adds on {date}', { date: formatDate(status.date, 'dayMonth') }),
        late: () => t('Not added yet'),
        paused: () => t('Paused'),
        ended: () => t('Ended after {month}', { month: monthName(status.month, { withYear: true }) }),
        upcoming: () => t('Starts in {month}', { month: monthName(status.month, { withYear: true }) }),
    }[status.key]();
    return (
        <span className={`exStatus is-${status.key}`}>
            <Icon aria-hidden="true" />
            {text}
        </span>
    );
};

const RecurringRow = ({ item, status, classImage, busy, thisMonth, onEdit, onToggle, onEnd, onResume, onDelete }) => {
    const { t, monthName } = useI18n();
    const ended = status.key === 'ended';
    const canEnd = !ended && item.starts_on <= thisMonth && item.ends_on !== thisMonth;
    const menu = [
        canEnd && { key: 'end', label: t('End after this month'), icon: LuCalendarX },
        (ended || item.ends_on) && { key: 'resume', label: t('Keep it going (no end date)'), icon: LuRepeat },
        { key: 'delete', label: t('Delete'), icon: LuTrash2, danger: true },
    ].filter(Boolean);
    const act = (key) => ({ end: onEnd, resume: onResume, delete: onDelete })[key](item);

    return (
        <motion.li variants={fadeUp} className={`exRecRow is-${status.key}`} data-recurring={item.id}>
            <CategoryIcon category={item.category} labelled />
            <span className="exRowMain">
                <strong className="exRowTitle">{item.description}</strong>
                <span className="exRowSub">
                    {item.class_id ? <ClassChip cls={item.class ?? { name: '—' }} image={classImage} /> : <span className="exRowCat">{t('Shared')}</span>}
                    {item.vendor && <span className="exRowVendor">{item.vendor}</span>}
                </span>
            </span>
            <span className="exRecWhen">
                <strong>{t('Day {day} of each month', { day: item.day_of_month })}</strong>
                <small>
                    {item.ends_on && !ended
                        ? t('Until {month}', { month: monthName(item.ends_on, { withYear: true }) })
                        : t('Since {month}', { month: monthName(item.starts_on, { withYear: true }) })}
                </small>
            </span>
            <span className="exRowAmount">
                <strong>{formatVnd(item.amount)}</strong>
                <small>{t('a month')}</small>
            </span>
            {/* display: contents on wide screens; one row (status left, buttons right) on phones */}
            <span className="exRecFoot">
                <span className="exRecStatus">
                    <StatusPill status={status} />
                </span>
                <span className="exRowActions">
                    {!ended && (
                        <Button
                            size="sm"
                            variant="flat"
                            className="exToggle"
                            startContent={item.active ? <LuPause aria-hidden="true" /> : <LuPlay aria-hidden="true" />}
                            isDisabled={busy}
                            aria-label={item.active ? t('Pause {name}', { name: item.description }) : t('Resume {name}', { name: item.description })}
                            onPress={() => onToggle(item)}
                        >
                            {item.active ? t('Pause') : t('Resume')}
                        </Button>
                    )}
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Edit {name}', { name: item.description })} isDisabled={busy} onPress={() => onEdit(item)}>
                        <LuPencil />
                    </Button>
                    <Dropdown placement="bottom-end" classNames={{ content: 'adminPortal' }}>
                        <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light" isLoading={busy} aria-label={t('More for {name}', { name: item.description })}>
                                <LuMoreVertical />
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label={t('Recurring cost actions')} onAction={(key) => act(String(key))}>
                            {menu.map(({ key, label, icon: Icon, danger }) => (
                                <DropdownItem key={key} startContent={<Icon aria-hidden="true" />} className={danger ? 'text-danger' : undefined} color={danger ? 'danger' : 'default'}>
                                    {label}
                                </DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                </span>
            </span>
        </motion.li>
    );
};

// Admins: the costs that come back every month (rent, internet, ads…). Each is added on its day
// by the nightly check; "Add this month's now" does it straight away.
const RecurringCard = ({ state, thisMonth, today, addedIds, classImages, busyId, running, onAdd, onRun, ...actions }) => {
    const { t, tn, monthName } = useI18n();
    const items = state.data ?? [];
    const statuses = new Map(items.map((item) => [item.id, recurringStatus(item, { thisMonth, today, addedIds })]));
    const live = items.filter((item) => ['added', 'due', 'late'].includes(statuses.get(item.id).key));
    const monthly = live.reduce((sum, item) => sum + Number(item.amount), 0);
    const late = items.filter((item) => statuses.get(item.id).key === 'late').length;

    return (
        <SectionCard
            id="expense-recurring"
            className="exRecurringCard"
            icon={LuRepeat}
            title={t('Recurring costs')}
            subtitle={t('Rent, internet, ads… They are added automatically on their day each month, so nobody types them twice.')}
            actions={
                <>
                    <Button variant="flat" startContent={running ? null : <LuCalendarCheck aria-hidden="true" />} isLoading={running} isDisabled={!thisMonth} onPress={onRun}>
                        {t('Add this month’s now')}
                    </Button>
                    <Button color="danger" variant="flat" startContent={<LuPlus aria-hidden="true" />} isDisabled={!thisMonth} onPress={onAdd}>
                        {t('Add recurring cost')}
                    </Button>
                </>
            }
        >
            {items.length > 0 && thisMonth && (
                <p className="exRecSummary">
                    <span>
                        {t('{count} running in {month}', { count: live.length, month: monthName(thisMonth) })}
                        {' · '}
                        <strong>{t('{amount} a month', { amount: formatVnd(monthly) })}</strong>
                    </span>
                    {late > 0 && (
                        <span className="exRecLate">
                            <LuAlertCircle aria-hidden="true" />
                            {tn(late, '{count} hasn’t been added yet this month', '{count} haven’t been added yet this month')}
                        </span>
                    )}
                </p>
            )}
            <AsyncState state={state} isEmpty={!state.loading && items.length === 0} emptyText="No recurring costs yet. Add rent, internet or ads once and they come back every month.">
                <motion.ul className="exRows exRecRows" variants={stagger} initial="hidden" animate="show">
                    {items.map((item) => (
                        <RecurringRow
                            key={item.id}
                            item={item}
                            status={statuses.get(item.id)}
                            classImage={classImages.get(item.class_id)}
                            busy={busyId === `rec-${item.id}`}
                            thisMonth={thisMonth}
                            {...actions}
                        />
                    ))}
                </motion.ul>
            </AsyncState>
            <p className="exFinePrint">
                {t('Pause one to skip months while it is paused. End it when the contract stops: the months already added stay. Deleting it keeps those months too.')}
            </p>
        </SectionCard>
    );
};

export default RecurringCard;
