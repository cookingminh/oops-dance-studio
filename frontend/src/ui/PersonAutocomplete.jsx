import { Autocomplete, AutocompleteItem, User } from '@nextui-org/react';
import { avatarUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { useI18n } from '@/i18n/i18nContext';

const displayName = (person) => person.full_name || person.username || person.email;

// Searchable picker over profiles (name, username or email).
const PersonAutocomplete = ({ label, people, value, onChange, isRequired, isDisabled, isLoading }) => {
    const { t } = useI18n();
    return (
    <Autocomplete
        label={label}
        placeholder={t('Search by name or email')}
        defaultItems={people}
        selectedKey={value ?? null}
        onSelectionChange={(key) => onChange(key ? String(key) : null)}
        isRequired={isRequired}
        isDisabled={isDisabled}
        isLoading={isLoading}
    >
        {(person) => (
            <AutocompleteItem key={person.id} textValue={`${displayName(person)} (${person.email})`}>
                <User
                    name={displayName(person)}
                    description={person.email}
                    avatarProps={{ ...AVATAR_DEFAULTS, size: 'sm', src: avatarUrl(person.avatar_path, person.updated_at) ?? undefined, name: displayName(person) }}
                />
            </AutocompleteItem>
        )}
    </Autocomplete>
    );
};

export default PersonAutocomplete;
