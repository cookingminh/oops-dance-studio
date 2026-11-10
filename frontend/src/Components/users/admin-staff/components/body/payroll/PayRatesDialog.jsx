import { useState } from 'react';
import { Avatar, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuRotateCcw } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getClassRates, getDefaultSessionRate, getStaffSalaries, setClassRate, setDefaultSessionRate, setStaffSalary } from '@/services/payroll';
import { listClasses } from '@/services/classes';
import { listProfiles } from '@/services/users';
import { avatarUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { roleTitle } from './payrollShared';

async function load() {
    const [defaultRate, classRates, salaries, classes, profiles] = await Promise.all([
        getDefaultSessionRate(),
        getClassRates(),
        getStaffSalaries(),
        listClasses(),
        listProfiles(),
    ]);
    // Office staff, plus any admin who already has a salary.
    const staff = profiles.filter((p) => p.role === 'staff' || (p.role === 'admin' && salaries[p.id] !== undefined));
    return { defaultRate, classRates, salaries, classes, staff };
}

const asText = (value) => (value === undefined || value === null ? '' : String(value));
const parse = (text) => (text.trim() === '' ? null : Number(text));
const valid = (text) => text.trim() === '' || (Number.isInteger(Number(text)) && Number(text) >= 0);

// What a session is worth (default and per class) and each office staff member's monthly salary.
// Changes apply to every month that isn't finalized yet.
const PayRatesDialog = ({ onClose, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const data = useAsync(load, []);
    const [draft, setDraft] = useState(null); // { defaultRate, classRates: {id: text}, salaries: {id: text} }
    const [saving, setSaving] = useState(false);

    if (data.data && !draft) {
        setDraft({
            defaultRate: asText(data.data.defaultRate),
            classRates: Object.fromEntries(data.data.classes.map((c) => [c.id, asText(data.data.classRates[c.id])])),
            salaries: Object.fromEntries(data.data.staff.map((p) => [p.id, asText(data.data.salaries[p.id])])),
        });
    }

    const set = (group, id) => (value) => setDraft((prev) => ({ ...prev, [group]: { ...prev[group], [id]: value } }));
    const defaultValid = draft && draft.defaultRate.trim() !== '' && valid(draft.defaultRate);
    const allValid =
        draft && defaultValid && Object.values(draft.classRates).every(valid) && Object.values(draft.salaries).every(valid);

    const save = async () => {
        setSaving(true);
        try {
            const before = data.data;
            const rate = Number(draft.defaultRate);
            if (rate !== before.defaultRate) await setDefaultSessionRate(rate);
            for (const cls of before.classes) {
                const next = parse(draft.classRates[cls.id]);
                if (next !== (before.classRates[cls.id] ?? null)) await setClassRate(cls.id, next);
            }
            for (const person of before.staff) {
                const next = parse(draft.salaries[person.id]);
                if (next !== (before.salaries[person.id] ?? null)) await setStaffSalary(person.id, next);
            }
            toast.success('Rates and salaries saved.');
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} size="2xl" scrollBehavior="inside" placement="center" classNames={{ base: 'adminPortal' }}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <span>{t('Rates & salaries')}</span>
                    <span className="text-small font-normal text-default-500">{t('Changes apply to every month that isn’t finalized yet.')}</span>
                </ModalHeader>
                <ModalBody>
                    <AsyncState state={data} isEmpty={false}>
                        {draft && (
                            <div className="payRates">
                                <section>
                                    <h4>{t('Instructors: pay per completed session')}</h4>
                                    <Input
                                        label={t('Default rate per session (VND)')}
                                        type="number"
                                        min={0}
                                        step={10000}
                                        value={draft.defaultRate}
                                        onValueChange={(value) => setDraft((prev) => ({ ...prev, defaultRate: value }))}
                                        isInvalid={!defaultValid}
                                        description={t('Used for every class without its own rate.')}
                                    />
                                    <ul className="payRateList">
                                        {data.data.classes.map((cls) => {
                                            const text = draft.classRates[cls.id];
                                            const custom = text.trim() !== '';
                                            return (
                                                <li key={cls.id}>
                                                    <span className="payRateName">
                                                        <strong>{cls.name}</strong>
                                                        <small>{cls.instructor?.full_name || cls.instructor?.username}</small>
                                                    </span>
                                                    <Input
                                                        aria-label={t('Rate for {name}', { name: cls.name })}
                                                        size="sm"
                                                        type="number"
                                                        min={0}
                                                        step={10000}
                                                        className="payRateInput"
                                                        placeholder={t('Default · {amount}', { amount: formatVnd(Number(draft.defaultRate) || 0) })}
                                                        value={text}
                                                        onValueChange={set('classRates', cls.id)}
                                                        isInvalid={!valid(text)}
                                                    />
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="light"
                                                        aria-label={t('Use the default rate')}
                                                        isDisabled={!custom}
                                                        onPress={() => set('classRates', cls.id)('')}
                                                    >
                                                        <LuRotateCcw />
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>

                                <section>
                                    <h4>{t('Staff: monthly salary')}</h4>
                                    {data.data.staff.length === 0 && <p className="payEmpty">{t('No staff accounts yet.')}</p>}
                                    <ul className="payRateList">
                                        {data.data.staff.map((person) => {
                                            const name = person.full_name || person.username;
                                            return (
                                                <li key={person.id}>
                                                    <span className="payRateName isPerson">
                                                        <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={name} />
                                                        <span>
                                                            <strong>{name}</strong>
                                                            <small>{t(roleTitle(person.role))}</small>
                                                        </span>
                                                    </span>
                                                    <Input
                                                        aria-label={t('Monthly salary for {name}', { name })}
                                                        size="sm"
                                                        type="number"
                                                        min={0}
                                                        step={100000}
                                                        className="payRateInput"
                                                        placeholder={t('Not set')}
                                                        value={draft.salaries[person.id]}
                                                        onValueChange={set('salaries', person.id)}
                                                        isInvalid={!valid(draft.salaries[person.id])}
                                                    />
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            </div>
                        )}
                    </AsyncState>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" onPress={save} isLoading={saving} isDisabled={!allValid}>
                        {t('Save')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default PayRatesDialog;
