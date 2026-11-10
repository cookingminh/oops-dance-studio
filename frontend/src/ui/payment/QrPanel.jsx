import { LuExternalLink, LuScanLine, LuStore } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import './payment.scss';

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
export const DeskPanel = ({ code, due }) => {
    const { t } = useI18n();
    return (
        <div className="tuQrPanel isDesk">
            <span className="tuDeskArt" aria-hidden="true">
                <LuStore />
            </span>
            <strong className="tuQrAmount">{formatVnd(due)}</strong>
            <span className="tuQrHint">{t('Pay in cash at the studio desk and mention this code:')}</span>
            <span className="tuDeskCode">{code}</span>
        </div>
    );
};
