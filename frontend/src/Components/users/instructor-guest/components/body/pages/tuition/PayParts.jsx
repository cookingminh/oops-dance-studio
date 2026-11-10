import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { DeskPanel as SharedDeskPanel } from '@/ui/payment/QrPanel';
import { PaidCelebration, WaitingNote } from '@/ui/payment/PayExtras';
import CopyRow from '@/ui/payment/CopyRow';

// The pieces of the pay dialog (PayDialog.jsx).

// The QR card (shared with the room bookings' pay dialog).
export { QrPanel } from '@/ui/payment/QrPanel';

// No bank account set up yet: the code to mention at the desk.
export const DeskPanel = ({ invoice, due }) => <SharedDeskPanel code={invoice.payment_code} due={due} />;

// Bank details with copy buttons and the three steps. `children` goes last (the sandbox's
// simulate button).
export const PayInfo = ({ invoice, settings, hasQr, due, children }) => {
    const { t } = useI18n();
    const paid = Number(invoice.paid_amount);
    const steps = hasQr
        ? [
            { title: t('Open your banking app'), text: t('Any Vietnamese bank works.') },
            { title: t('Scan the QR code'), text: t('Account, amount and content fill in by themselves.') },
            { title: t('Keep the content exactly as shown'), text: t('{code} tells us which course you’re paying for.', { code: invoice.payment_code }) },
        ]
        : [
            { title: t('Come to the front desk'), text: t('Any time the studio is open.') },
            { title: t('Mention your code'), text: t('{code} tells us which course you’re paying for.', { code: invoice.payment_code }) },
            { title: t('That’s it'), text: t('This page turns green once the studio records it.') },
        ];

    return (
        <div className="tuPayInfo">
            {paid > 0 && (
                <p className="tuPartial">
                    {t('You’ve paid {paid} of {amount}. Just {left} left.', { paid: formatVnd(paid), amount: formatVnd(invoice.amount), left: formatVnd(due) })}
                </p>
            )}
            {hasQr && (
                <dl className="tuCopyList">
                    <CopyRow label={t('Bank')} value={settings.bank_name || settings.bank_code} />
                    <CopyRow label={t('Account number')} value={settings.account_no} mono />
                    {settings.account_name && <CopyRow label={t('Account name')} value={settings.account_name} />}
                    <CopyRow label={paid > 0 ? t('Amount left') : t('Amount')} value={formatVnd(due)} copyText={String(due)} />
                    <CopyRow label={t('Transfer content')} value={invoice.payment_code} mono isKey />
                </dl>
            )}
            <ol className="tuSteps">
                {steps.map(({ title, text }, index) => (
                    <li key={title}>
                        <span className="tuStepNum" aria-hidden="true">
                            {index + 1}
                        </span>
                        <span>
                            <strong>{title}</strong>
                            <small>{text}</small>
                        </span>
                    </li>
                ))}
            </ol>
            {children}
        </div>
    );
};

// "Waiting for your transfer…" with a breathing dot, under the QR.
export const Waiting = ({ invoice, hasQr }) => {
    const { t } = useI18n();
    return (
        <WaitingNote
            stopped={invoice.status !== 'unpaid' && t('The studio has changed this invoice. Close this window to see where it stands.')}
            title={hasQr ? t('Waiting for your transfer…') : t('Waiting for the studio…')}
            text={hasQr ? t('This updates by itself a few seconds after the bank confirms.') : t('This updates by itself once the studio records it.')}
        />
    );
};

// A short celebration once the server says it's paid.
export const PaidMoment = ({ invoice, onDone }) => {
    const { t } = useI18n();
    return (
        <PaidCelebration
            title={t('Paid. Thank you!')}
            text={t('{course} in {className} is all set. See you on the dance floor!', { className: invoice.class_name, course: invoice.lesson_title || invoice.class_name })}
            amount={formatVnd(invoice.paid_amount)}
            onDone={onDone}
        />
    );
};
