import { motion } from 'framer-motion';
import { Button, Tooltip } from '@nextui-org/react';
import { LuFileText, LuImage, LuInfo, LuPencil, LuTrash2 } from 'react-icons/lu';
import { categoryOf, expenseTitle, isAutomaticRent } from '@/lib/expenseCategories';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../common/motion';
import { AUTO_RENT_HINT, AutoRentBadge, CategoryIcon, ClassChip, RecurringBadge } from './ExpenseParts';
import { isPdfPath } from './expensesModel';

const METHODS = { cash: 'Cash', transfer: 'Bank transfer' };

// The receipt as a small thumbnail (photo) or a file icon (PDF, which opens straight away).
const ReceiptCell = ({ expense, title, url, onView }) => {
    const { t } = useI18n();
    if (!expense.receipt_path) return <span className="exReceiptCell isNone" aria-hidden="true" />;
    const pdf = isPdfPath(expense.receipt_path);
    const label = pdf ? t('Open the PDF receipt for {name}', { name: title }) : t('View receipt for {name}', { name: title });
    if (pdf && url) {
        return (
            <a className="exReceiptCell isPdf" href={url} target="_blank" rel="noreferrer" aria-label={label} title={label}>
                <LuFileText aria-hidden="true" />
                <span aria-hidden="true">PDF</span>
            </a>
        );
    }
    return (
        <button type="button" className={`exReceiptCell${pdf ? ' isPdf' : ''}`} onClick={() => onView(expense)} aria-label={label} title={label}>
            {url && !pdf ? <img src={url} alt="" loading="lazy" /> : pdf ? <LuFileText aria-hidden="true" /> : <LuImage aria-hidden="true" />}
        </button>
    );
};

// One cost: what (category, description, vendor), for which class, when and how it was paid,
// its receipt, who wrote it down, how much, and edit / delete. A rented studio's automatic rent isn't
// edited (it follows its session); only admins may delete it (RLS), and the list shows it to them only.
const ExpenseRow = ({ expense, receiptUrl, classImage, showAuthor, meId, busy, onEdit, onDelete, onView }) => {
    const { t, formatDate } = useI18n();
    const category = categoryOf(expense.category);
    const automatic = isAutomaticRent(expense);
    const title = expenseTitle(expense, t);
    const author = expense.created_by === meId ? t('you') : expense.author?.full_name || expense.author?.username || null;

    return (
        <motion.li variants={fadeUp} layout="position" className={`exRow${busy ? ' isBusy' : ''}`} data-expense={expense.id}>
            <CategoryIcon category={expense.category} labelled />
            <span className="exRowMain">
                <strong className="exRowTitle">{title}</strong>
                <span className="exRowSub">
                    <span className="exRowCat">{t(category.label)}</span>
                    {expense.vendor && <span className="exRowVendor">{expense.vendor}</span>}
                    {expense.recurring_id && <RecurringBadge />}
                    {automatic && <AutoRentBadge />}
                </span>
            </span>
            <span className="exRowClass">
                {expense.class_id ? <ClassChip cls={expense.class ?? { name: '—' }} image={classImage} /> : <span className="exShared">{t('Shared')}</span>}
            </span>
            <span className="exRowWhen">
                <strong>{formatDate(expense.spent_on, 'short')}</strong>
                <small>{expense.method ? t(METHODS[expense.method]) : t('Not set')}</small>
            </span>
            <ReceiptCell expense={expense} title={title} url={receiptUrl} onView={onView} />
            <span className="exRowAmount">
                <strong>{formatVnd(expense.amount)}</strong>
                {showAuthor && author && <small>{t('by {name}', { name: author })}</small>}
            </span>
            <span className="exRowActions">
                {automatic ? (
                    <Tooltip content={t(AUTO_RENT_HINT)} classNames={{ content: 'exTip' }} placement="top-end">
                        <Button isIconOnly size="sm" variant="light" aria-label={t(AUTO_RENT_HINT)}>
                            <LuInfo />
                        </Button>
                    </Tooltip>
                ) : (
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Edit {name}', { name: title })} isDisabled={busy} onPress={() => onEdit(expense)}>
                        <LuPencil />
                    </Button>
                )}
                <Button isIconOnly size="sm" variant="light" className="exDanger" aria-label={t('Delete {name}', { name: title })} isLoading={busy} onPress={() => onDelete(expense)}>
                    <LuTrash2 />
                </Button>
            </span>
        </motion.li>
    );
};

export default ExpenseRow;
