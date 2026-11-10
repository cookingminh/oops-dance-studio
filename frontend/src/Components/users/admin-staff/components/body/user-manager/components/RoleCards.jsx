import { LuCheck, LuDoorOpen } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { KINDS, ROLE_CHOICES, ROLE_INFO } from '../peopleModel';

// Role picker as radio cards: what each role does and which pages it opens.
// `notes` ({ [role]: text }) adds a small badge, e.g. "Current". `autoFocus` focuses the checked one.
const RoleCards = ({ name, value, onChange, notes = {}, label, autoFocus = false }) => {
    const { t } = useI18n();
    return (
        <fieldset className="roleCards">
            <legend className="sr-only">{label}</legend>
            {ROLE_CHOICES.map((role) => {
                const info = ROLE_INFO[role];
                const Icon = KINDS[info.kind].icon;
                const checked = value === role;
                return (
                    <label key={role} className={`roleCard${checked ? ' isChecked' : ''}`} data-tone={KINDS[info.kind].tone}>
                        <input type="radio" name={name} value={role} checked={checked} onChange={() => onChange(role)} autoFocus={autoFocus && checked} />
                        <span className="roleCardIcon" aria-hidden="true">
                            <Icon />
                        </span>
                        <span className="roleCardText">
                            <strong>
                                {t(info.title)}
                                {notes[role] && <span className="roleCardNote">{notes[role]}</span>}
                            </strong>
                            <small>{t(info.summary)}</small>
                            <small className="roleCardOpens">
                                <LuDoorOpen aria-hidden="true" />
                                <span>{t(info.opens)}</span>
                            </small>
                        </span>
                        <span className="roleCardCheck" aria-hidden="true">
                            <LuCheck />
                        </span>
                    </label>
                );
            })}
        </fieldset>
    );
};

export default RoleCards;
