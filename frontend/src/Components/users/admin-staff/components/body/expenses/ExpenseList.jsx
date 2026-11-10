import { motion } from 'framer-motion';
import { Button, Input, Select, SelectItem } from '@nextui-org/react';
import { LuPlus, LuReceipt, LuSearch, LuX } from 'react-icons/lu';
import { EXPENSE_CATEGORIES } from '@/lib/expenseCategories';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import { stagger } from '../../common/motion';
import { capitalizeFirst, expenseSearchText, fold, matchesFilters, sumAmount } from './expensesModel';
import ExpenseRow from './ExpenseRow';

// The month's costs, newest first: filter by category and class, search, and edit or delete
// each one. The footer adds up what is shown.
const ExpenseList = ({ month, thisMonth, state, filters, onFilter, onClear, receipts, classImages, isAdmin, meId, busyId, onAdd, onEdit, onDelete, onView }) => {
    const { t, tn, monthName } = useI18n();
    const rows = state.data ?? [];

    const term = fold(filters.query.trim());
    const visible = rows.filter((row) => matchesFilters(row, filters) && (!term || expenseSearchText(row, t).includes(term)));
    const filtered = filters.category !== 'all' || filters.classKey !== 'all' || Boolean(term);

    // Only categories and classes that occur this month (plus a picked one) are offered.
    const categoryKeys = new Set(rows.map((row) => row.category));
    const categoryOptions = EXPENSE_CATEGORIES.filter((category) => categoryKeys.has(category.key) || category.key === filters.category);
    const classOptions = [...new Map(rows.filter((row) => row.class_id).map((row) => [String(row.class_id), row.class?.name ?? '—'])).entries()];
    if (filters.classKey !== 'all' && filters.classKey !== 'shared' && !classOptions.some(([id]) => id === filters.classKey)) classOptions.push([filters.classKey, '—']);

    const monthLabel = month ? monthName(month, { withYear: true }) : '';

    return (
        <SectionCard
            id="expense-list"
            className="exListCard"
            icon={LuReceipt}
            title={isAdmin ? t('The month’s costs') : month === thisMonth ? t('Your costs this month') : t('Your costs in {month}', { month: monthName(month ?? thisMonth) })}
            subtitle={month ? `${tn(rows.length, '{count} cost in {month}', '{count} costs in {month}', { month: monthLabel })} · ${formatVnd(sumAmount(rows))}` : ''}
            actions={
                <Input
                    isClearable
                    aria-label={t('Search costs')}
                    placeholder={t('Description, vendor, class…')}
                    className="exSearch"
                    startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                    value={filters.query}
                    onValueChange={(query) => onFilter({ query })}
                    onClear={() => onFilter({ query: '' })}
                />
            }
        >
            {rows.length > 0 && (
                <div className="exToolbar">
                    <Select
                        size="sm"
                        label={t('Category')}
                        className="exFilterSelect"
                        selectedKeys={[filters.category]}
                        disallowEmptySelection
                        onChange={(event) => onFilter({ category: event.target.value || 'all' })}
                        classNames={{ popoverContent: 'adminPortal' }}
                    >
                        {[
                            <SelectItem key="all">{t('All categories')}</SelectItem>,
                            ...categoryOptions.map((category) => <SelectItem key={category.key}>{t(category.label)}</SelectItem>),
                        ]}
                    </Select>
                    <Select
                        size="sm"
                        label={t('Class')}
                        className="exFilterSelect"
                        selectedKeys={[filters.classKey]}
                        disallowEmptySelection
                        onChange={(event) => onFilter({ classKey: event.target.value || 'all' })}
                        classNames={{ popoverContent: 'adminPortal' }}
                    >
                        {[
                            <SelectItem key="all">{t('Classes and shared')}</SelectItem>,
                            <SelectItem key="shared">{t('Shared costs only')}</SelectItem>,
                            ...classOptions.map(([id, name]) => <SelectItem key={id}>{name}</SelectItem>),
                        ]}
                    </Select>
                    {filtered && (
                        <Button size="sm" variant="light" startContent={<LuX aria-hidden="true" />} onPress={onClear}>
                            {t('Clear filters')}
                        </Button>
                    )}
                    <span className="exShownTotal" aria-live="polite">
                        {filtered
                            ? t('{count} shown · {amount}', { count: visible.length, amount: formatVnd(sumAmount(visible)) })
                            : t('Total {amount}', { amount: formatVnd(sumAmount(rows)) })}
                    </span>
                </div>
            )}

            <AsyncState
                state={state}
                isEmpty={!state.loading && rows.length === 0}
                emptyText={
                    <span className="exEmpty">
                        <span>
                            {isAdmin
                                ? t('No costs in {month} yet.', { month: capitalizeFirst(monthLabel) })
                                : t('You haven’t recorded any costs in {month}. Bought something for the studio? Add it here.', { month: monthLabel })}
                        </span>
                        <Button size="sm" variant="flat" color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={onAdd}>
                            {t('Add expense')}
                        </Button>
                    </span>
                }
            >
                {visible.length === 0 ? (
                    <div className="tableEmpty exEmpty">
                        <span>{t('No costs match these filters.')}</span>
                        <Button size="sm" variant="flat" onPress={onClear}>
                            {t('Show every cost')}
                        </Button>
                    </div>
                ) : (
                    <motion.ul key={month} className="exRows" variants={stagger} initial="hidden" animate="show">
                        {visible.map((expense) => (
                            <ExpenseRow
                                key={expense.id}
                                expense={expense}
                                receiptUrl={receipts[expense.receipt_path]}
                                classImage={classImages.get(expense.class_id)}
                                showAuthor={isAdmin}
                                meId={meId}
                                busy={busyId === expense.id}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onView={onView}
                            />
                        ))}
                    </motion.ul>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default ExpenseList;
