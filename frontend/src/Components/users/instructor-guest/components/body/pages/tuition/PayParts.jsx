import { Button } from '@nextui-org/react';
import { motion } from 'framer-motion';
import { LuCheck, LuExternalLink, LuScanLine, LuStore } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { EASE_OUT } from '../../../../../admin-staff/components/common/motion';
import { CopyRow } from './TuitionParts';

// The pieces of the pay dialog (PayDialog.jsx).

// The VietQR image on a warm card. In the sandbox a band across it says it isn't real.
export const QrPanel = ({ qr, due, sandbox }) => {
    const { t } = useI18n();
    return (
        <div className="tuQrPanel">
            <div className={`tuQrFrame${sandbox ? ' isDemo' : ''}`}>
                <img src={qr} alt={t('QR code to pay {amount}', { amount: formatVnd(due) })} width="280" height="280" />
                {sandbox && (
                    <span className="tuDemoBand" role="note">
                        <strong>{t('Demo')}</strong>
                        <span>{t('Don’t transfer real money')}</span>
                    </span>
                )}
            </div>
            <strong className="tuQrAmount">{formatVnd(due)}</strong>
            <span className="tuQrHint">
                <LuScanLine aria-hidden="true" /> {t('Scan with any Vietnamese banking app')}
            </span>
            {/* Paying from this same phone: open the image, save it, then pick it in the bank app. */}
            <a className="tuQrOpen" href={qr} target="_blank" rel="noreferrer">
                {t('Open the QR image to save it')} <LuExternalLink aria-hidden="true" />
            </a>
        </div>
    );
};

// No bank account set up yet: the code to mention at the desk.
export const DeskPanel = ({ invoice, due }) => {
    const { t } = useI18n();
    return (
        <div className="tuQrPanel isDesk">
            <span className="tuDeskArt" aria-hidden="true">
                <LuStore />
            </span>
            <strong className="tuQrAmount">{formatVnd(due)}</strong>
            <span className="tuQrHint">{t('Pay in cash at the studio desk and mention this code:')}</span>
            <span className="tuDeskCode">{invoice.payment_code}</span>
        </div>
    );
};

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
    if (invoice.status !== 'unpaid') {
        return <p className="tuWaiting isStopped">{t('The studio has changed this invoice. Close this window to see where it stands.')}</p>;
    }
    return (
        <p className="tuWaiting" role="status">
            <span className="pfPulse" aria-hidden="true" />
            <span>
                <strong>{hasQr ? t('Waiting for your transfer…') : t('Waiting for the studio…')}</strong>
                <small>{hasQr ? t('This updates by itself a few seconds after the bank confirms.') : t('This updates by itself once the studio records it.')}</small>
            </span>
        </p>
    );
};

// A short celebration once the server says it's paid.
export const PaidMoment = ({ invoice, onDone }) => {
    const { t } = useI18n();
    return (
        <motion.div
            className="tuPaidMoment"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
        >
            <span className="tuPaidBurst" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                    <i key={index} style={{ '--i': index }} />
                ))}
                <motion.span
                    className="tuPaidCheck"
                    initial={{ scale: 0.4, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.05 }}
                >
                    <LuCheck />
                </motion.span>
            </span>
            <h3>{t('Paid. Thank you!')}</h3>
            <p>{t('{course} in {className} is all set. See you on the dance floor!', { className: invoice.class_name, course: invoice.lesson_title || invoice.class_name })}</p>
            <span className="tuPaidAmount">{formatVnd(invoice.paid_amount)}</span>
            <Button color="danger" className="tuPaidDone" onPress={onDone}>
                {t('Done')}
            </Button>
        </motion.div>
    );
};
