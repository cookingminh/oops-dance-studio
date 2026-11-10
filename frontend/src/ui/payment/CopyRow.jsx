import { useEffect, useRef, useState } from 'react';
import { LuCheck, LuCopy } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import './payment.scss';

// One fact of the transfer (bank, account, amount, content) with a copy button.
// `copyText` is what lands in the clipboard (digits only for the amount).
const CopyRow = ({ label, value, copyText = value, isKey = false, mono = false }) => {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(String(copyText));
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1800);
        } catch {
            // Clipboard blocked (insecure context): the value stays selectable on screen.
        }
    };

    return (
        <div className={`tuCopyRow${isKey ? ' isKey' : ''}`}>
            <dt>{label}</dt>
            <dd>
                <span className={`tuCopyValue${mono ? ' isMono' : ''}`}>{value}</span>
                <button
                    type="button"
                    className={`tuCopyBtn${copied ? ' isDone' : ''}`}
                    onClick={copy}
                    aria-label={t('Copy {value}', { value: label })}
                    title={t('Copy {value}', { value: label })}
                >
                    {copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
                    <span className="tuCopyTip" aria-live="polite">
                        {copied ? t('Copied') : ''}
                    </span>
                </button>
            </dd>
        </div>
    );
};

export default CopyRow;
