import { useEffect, useState } from 'react';
import { Button, Input, Switch } from '@nextui-org/react';
import { LuInfo, LuQrCode, LuSave } from 'react-icons/lu';
import { updateTuitionSettings, vietQrUrl } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AutoPayments from './AutoPayments';

// invoice_day / due_day are left over from monthly tuition and no longer used: not shown.
const FIELDS = ['bank_code', 'bank_name', 'account_no', 'account_name', 'renewal_open_sessions', 'due_session'];
const EXAMPLE_SESSIONS = 8;
const isWhole = (v, min, max) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;
const SAMPLE = { amount: 1000000, paid_amount: 0, payment_code: 'OOPS7K3M9Q' };

// Same rules as the tuition_settings checks, so a save never bounces.
const RULES = {
    bank_code: (v) => v === '' || /^[A-Za-z0-9]{2,20}$/.test(v),
    bank_name: (v) => v.length <= 80,
    account_no: (v) => v === '' || /^[0-9A-Za-z]{4,30}$/.test(v),
    account_name: (v) => v.length <= 80,
    renewal_open_sessions: (v) => isWhole(v, 0, 10),
    due_session: (v) => isWhole(v, 1, 10),
};

const toForm = (settings) => Object.fromEntries(FIELDS.map((key) => [key, String(settings?.[key] ?? '')]));

// Waits until typing stops before the QR preview asks img.vietqr.io for a new image.
function useDebounced(value, ms = 600) {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), ms);
        return () => clearTimeout(timer);
    }, [value, ms]);
    return settled;
}

// Admin only (in a drawer of the tuition page): the bank account on every QR code (with a live
// preview), the course renewal rules and how to connect automatic payments.
const TuitionSettings = ({ settings, sandbox, onSaved }) => {
    const { t, tn } = useI18n();
    const toast = useToast();
    const [form, setForm] = useState(() => toForm(settings));
    const [prorate, setProrate] = useState(Boolean(settings?.prorate_late_join ?? true));
    const [saving, setSaving] = useState(false);
    const preview = useDebounced(form);

    // A fresh copy from the server (after saving) replaces the form.
    useEffect(() => {
        setForm(toForm(settings));
        setProrate(Boolean(settings?.prorate_late_join ?? true));
    }, [settings]);

    const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: key === 'account_name' ? value.toUpperCase() : value }));
    const trimmed = Object.fromEntries(FIELDS.map((key) => [key, form[key].trim()]));
    const invalid = FIELDS.filter((key) => !RULES[key](trimmed[key]));
    const prorateChanged = prorate !== Boolean(settings?.prorate_late_join ?? true);
    const changed = [...FIELDS.filter((key) => trimmed[key] !== String(settings?.[key] ?? '')), ...(prorateChanged ? ['prorate_late_join'] : [])];
    const fields = { ...trimmed, prorate_late_join: prorate };
    const openAt = RULES.renewal_open_sessions(trimmed.renewal_open_sessions) ? Number(trimmed.renewal_open_sessions) : null;
    const dueAt = RULES.due_session(trimmed.due_session) ? Number(trimmed.due_session) : null;
    const qr = vietQrUrl({ bank_code: preview.bank_code.trim(), account_no: preview.account_no.trim(), account_name: preview.account_name.trim() }, SAMPLE);
    const previewValid = RULES.bank_code(preview.bank_code.trim()) && RULES.account_no(preview.account_no.trim());

    const save = async (event) => {
        event.preventDefault();
        if (invalid.length || !changed.length) return;
        setSaving(true);
        try {
            await updateTuitionSettings(Object.fromEntries(changed.map((key) => [key, fields[key]])));
            toast.success(t('Payment settings saved.'));
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const field = (key, label, extra = {}) => (
        <Input
            label={label}
            value={form[key]}
            onValueChange={set(key)}
            isInvalid={invalid.includes(key)}
            {...extra}
        />
    );

    return (
        <>
            <form className="tuSettings" onSubmit={save} noValidate>
                <section className="tuSettingsBlock" aria-labelledby="tu-bank-title">
                    <h3 id="tu-bank-title">{t('Bank account')}</h3>
                    <p className="tuFinePrint">{t('Only admins see this. The bank account is on every QR code students scan.')}</p>
                    <div className="tuBankGrid">
                        <div className="tuSettingsFields">
                            <div className="tuFieldPair">
                                {field('bank_code', t('Bank code'), { placeholder: '970436 / VCB', description: t('The bank’s BIN or short name.'), errorMessage: t('2–20 letters or digits.') })}
                                {field('bank_name', t('Bank name'), { placeholder: 'Vietcombank' })}
                            </div>
                            {field('account_no', t('Account number'), { inputMode: 'numeric', errorMessage: t('4–30 letters or digits.') })}
                            {field('account_name', t('Account name'), { placeholder: 'NGUYEN VAN A', description: t('As the bank writes it, without accents.') })}
                        </div>
                        <figure className="tuQrPreview">
                            <div className={`tuQrBox${qr && previewValid ? '' : ' isEmpty'}`}>
                                {qr && previewValid ? <img key={qr} src={qr} alt={t('Preview of the QR code students scan')} /> : <LuQrCode aria-hidden="true" />}
                                {sandbox && <span className="tuDemoRibbon">{t('Demo — don’t transfer real money')}</span>}
                            </div>
                            <figcaption>
                                {qr && previewValid
                                    ? t('Live preview: {amount} with the code {code} in the transfer content.', { amount: formatVnd(SAMPLE.amount), code: SAMPLE.payment_code })
                                    : t('Enter the bank code and account number to see the QR code.')}
                            </figcaption>
                        </figure>
                    </div>
                </section>

                <section className="tuSettingsBlock" aria-labelledby="tu-rules-title">
                    <h3 id="tu-rules-title">{t('Courses and renewal')}</h3>
                    <div className="tuFieldPair">
                        {field('renewal_open_sessions', t('Open the renewal with sessions left'), {
                            type: 'number',
                            min: 0,
                            max: 10,
                            description: t('When the running course has this many sessions left, every member gets the next course’s invoice (once it’s planned). 0–10.'),
                            errorMessage: t('A whole number from 0 to 10.'),
                        })}
                        {field('due_session', t('Pay or answer by session'), {
                            type: 'number',
                            min: 1,
                            max: 10,
                            description: t('Of the new course, and at least 3 days after it opens. Unpaid with no answer by then: they leave the class. 1–10.'),
                            errorMessage: t('A whole number from 1 to 10.'),
                        })}
                    </div>
                    <Switch isSelected={prorate} onValueChange={setProrate} size="sm" color="danger" className="tuSwitch">
                        <span className="tuSwitchText">
                            <strong>{t('Joining mid-course pays only for the sessions left')}</strong>
                            <small>{t('For someone new. Members carrying on always pay the whole course. Off: everyone pays the whole course.')}</small>
                        </span>
                    </Switch>
                    {openAt !== null && dueAt !== null && (
                        <p className="tuExample">
                            <LuInfo aria-hidden="true" />
                            <span>
                                {openAt === 0
                                    ? t('Example, a course of {total} sessions: the next course opens once it is over, and students pay or answer by its session {due}.', { total: EXAMPLE_SESSIONS, due: dueAt })
                                    : tn(openAt, 'Example, a course of {total} sessions: the next course opens after session {after} ({count} left), and students pay or answer by its session {due}.', 'Example, a course of {total} sessions: the next course opens after session {after} ({count} left), and students pay or answer by its session {due}.', {
                                        total: EXAMPLE_SESSIONS,
                                        after: Math.max(0, EXAMPLE_SESSIONS - openAt),
                                        due: dueAt,
                                    })}
                            </span>
                        </p>
                    )}
                </section>

                <div className="tuSettingsSave">
                    {changed.length > 0 && <span>{t('Unsaved changes')}</span>}
                    <Button type="submit" color="danger" isLoading={saving} isDisabled={!changed.length || invalid.length > 0} startContent={saving ? null : <LuSave aria-hidden="true" />}>
                        {t('Save settings')}
                    </Button>
                </div>
            </form>

            <AutoPayments />
        </>
    );
};

export default TuitionSettings;
