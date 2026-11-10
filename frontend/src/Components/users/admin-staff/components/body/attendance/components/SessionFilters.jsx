import { Input, Select, SelectItem } from '@nextui-org/react';
import { LuSearch } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import StatusSelect from '../../../common/StatusSelect';

// Search, instructor, class and status pickers above the sessions (calendar and list share them).
// `filters` { query, instructor, classId, status }; `options` from filterOptions(); `statusOptions`
// already translated with counts.
const SessionFilters = ({ filters, onChange, options, statusOptions }) => {
    const { t } = useI18n();
    const set = (key) => (value) => onChange({ ...filters, [key]: value });
    return (
        <div className="atFilters">
            <Input
                isClearable
                aria-label={t('Search sessions')}
                placeholder={t('Search...')}
                className="atSearch"
                startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                value={filters.query}
                onValueChange={set('query')}
                onClear={() => set('query')('')}
            />
            <Select
                aria-label={t('Instructor')}
                className="atPicker"
                classNames={{ trigger: 'statusSelectTrigger', popoverContent: 'adminPortal' }}
                selectedKeys={[filters.instructor]}
                disallowEmptySelection
                onChange={(event) => set('instructor')(event.target.value || 'all')}
                items={[{ id: 'all', name: t('All instructors') }, ...options.instructors]}
            >
                {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Select
                aria-label={t('Class')}
                className="atPicker"
                classNames={{ trigger: 'statusSelectTrigger', popoverContent: 'adminPortal' }}
                selectedKeys={[filters.classId]}
                disallowEmptySelection
                onChange={(event) => set('classId')(event.target.value || 'all')}
                items={[{ id: 'all', name: t('All classes') }, ...options.classes]}
            >
                {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <StatusSelect label={t('Status')} options={statusOptions} value={filters.status} onChange={set('status')} />
        </div>
    );
};

export default SessionFilters;
