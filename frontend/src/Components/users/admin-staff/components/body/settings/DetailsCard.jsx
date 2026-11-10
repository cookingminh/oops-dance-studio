import { motion } from 'framer-motion';
import { Input } from '@nextui-org/react';
import { LuCheck, LuLock, LuPhone, LuUser } from 'react-icons/lu';
import DateField from '@/ui/DateField';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../common/motion';
import SaveBar from './SaveBar';

// A titled group of fields; its header matches SectionCard's.
const FieldGroup = ({ id, icon: Icon, title, subtitle, children }) => (
    <section id={id} className="fieldGroup" tabIndex={-1} aria-labelledby={`${id}-title`}>
        <header className="cardHeader">
            <span className="cardIcon" aria-hidden="true">
                <Icon />
            </span>
            <div className="cardTitles">
                <h2 id={`${id}-title`}>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
        </header>
        {children}
    </section>
);

// Username hint under the field while a new one is being checked.
function usernameHint(status, t) {
    if (status === 'checking') return t('Checking…');
    if (status === 'available') {
        return (
            <span className="fieldOk">
                <LuCheck aria-hidden="true" /> {t('That username is free')}
            </span>
        );
    }
    return undefined;
}

// Personal details and contact in one form with one save bar: they are saved together.
// Each field sits in a [data-field] wrapper so the profile checklist can jump to it.
const DetailsCard = ({ form, errors, usernameStatus, canSave, justSaved, onSave, email, emailNote, personalSubtitle }) => {
    const { t } = useI18n();
    const { profile, setField } = form;
    const errorOf = (field) => (errors[field] ? t(errors[field]) : undefined);
    const usernameTaken = usernameStatus === 'taken';

    const submit = (event) => {
        event.preventDefault();
        if (canSave) onSave();
    };

    return (
        <motion.form variants={fadeUp} className="adminCard detailsCard" onSubmit={submit} noValidate>
            <FieldGroup id="settings-personal" icon={LuUser} title={t('Personal details')} subtitle={personalSubtitle}>
                <div className="formGrid">
                    <div className="isFull" data-field="full_name">
                        <Input
                            label={t('Full Name')}
                            autoComplete="name"
                            value={profile.full_name}
                            onValueChange={setField('full_name')}
                            isInvalid={Boolean(errors.full_name)}
                            errorMessage={errorOf('full_name')}
                        />
                    </div>
                    <div data-field="username">
                        <Input
                            label={t('Username')}
                            autoComplete="username"
                            startContent={<span className="fieldPrefix" aria-hidden="true">@</span>}
                            value={profile.username}
                            onValueChange={setField('username')}
                            isInvalid={Boolean(errors.username) || usernameTaken}
                            errorMessage={usernameTaken ? t('That username is already taken.') : errorOf('username')}
                            description={usernameHint(usernameStatus, t)}
                        />
                    </div>
                    <div data-field="date_of_birth">
                        <DateField
                            label={t('Date of Birth')}
                            value={profile.date_of_birth}
                            onChange={setField('date_of_birth')}
                            isInvalid={Boolean(errors.date_of_birth)}
                            errorMessage={errorOf('date_of_birth')}
                        />
                    </div>
                </div>
            </FieldGroup>

            <FieldGroup id="settings-contact" icon={LuPhone} title={t('Contact')} subtitle={t('How the studio reaches you.')}>
                <div className="formGrid">
                    <div data-field="email">
                        <Input
                            label={t('Email')}
                            value={email}
                            isReadOnly
                            classNames={{ inputWrapper: 'isLockedField' }}
                            endContent={<LuLock className="fieldLock" aria-hidden="true" />}
                            description={emailNote}
                        />
                    </div>
                    <div data-field="contact_number">
                        <Input
                            label={t('Contact Number')}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={profile.contact_number}
                            onValueChange={setField('contact_number')}
                            isInvalid={Boolean(errors.contact_number)}
                            errorMessage={errorOf('contact_number')}
                        />
                    </div>
                </div>
            </FieldGroup>

            <SaveBar
                dirty={form.isDirty}
                blocked={usernameTaken || Object.keys(errors).length > 0}
                saving={form.saving}
                canSave={canSave}
                justSaved={justSaved}
                onDiscard={form.reset}
            />
        </motion.form>
    );
};

export default DetailsCard;
