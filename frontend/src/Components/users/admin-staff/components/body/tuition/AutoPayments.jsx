import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuKeyRound, LuZap } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { randomKey } from './tuitionModel';
import { CopyValue } from './TuitionParts';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-webhook`;

// How to connect the bank (SePay → the bank-webhook Edge Function). The nightly check runs from the
// tuition page's ⋯ menu.
const AutoPayments = () => {
    const { t } = useI18n();
    const [key, setKey] = useState('');
    const command = `supabase secrets set BANK_WEBHOOK_KEY=${key || '<key>'}`;

    return (
        <div className="tuSetup">
            <section className="tuSettingsBlock" aria-labelledby="tu-auto-title">
                <h3 id="tu-auto-title">
                    <LuZap aria-hidden="true" /> {t('Automatic payments')}
                </h3>
                <p>{t('Connect the studio’s bank account through SePay: a transfer with an invoice code then marks it paid within seconds. Until then, record payments here.')}</p>
                <ol className="tuSteps">
                    <li>
                        <strong>{t('Create a SePay account')}</strong>
                        <span>{t('At sepay.vn, then link the studio’s bank account.')}</span>
                    </li>
                    <li>
                        <strong>{t('Add a webhook')}</strong>
                        <span>{t('In SePay → Webhooks, send incoming money to this URL:')}</span>
                        <CopyValue value={WEBHOOK_URL} mono label={t('the webhook URL')} />
                    </li>
                    <li>
                        <strong>{t('Choose “API Key” authentication')}</strong>
                        <span>{t('SePay sends it as “Authorization: Apikey <key>”. Use a long random key:')}</span>
                        {key ? (
                            <CopyValue value={key} mono label={t('the key')} />
                        ) : (
                            <Button size="sm" variant="flat" startContent={<LuKeyRound aria-hidden="true" />} onPress={() => setKey(randomKey())} className="tuStepButton">
                                {t('Make a key')}
                            </Button>
                        )}
                    </li>
                    <li>
                        <strong>{t('Save the same key as the function secret')}</strong>
                        <span>{t('Run this once in the project folder:')}</span>
                        <CopyValue value={command} mono label={t('the command')} />
                    </li>
                    <li>
                        <strong>{t('Try it')}</strong>
                        <span>{t('Transfer a small amount with an invoice code in the content: it shows as paid on this page.')}</span>
                    </li>
                </ol>
            </section>
        </div>
    );
};

export default AutoPayments;
