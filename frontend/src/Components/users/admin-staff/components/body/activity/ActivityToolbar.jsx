import { useState } from 'react';
import { Avatar, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@nextui-org/react';
import { LuCpu, LuSearch, LuSlidersHorizontal, LuUsers, LuX } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import RoleChip from '../user-manager/components/RoleChip';
import { ACTIONS } from './activityModel';
import { AreaChips } from './ActivityOverview';

// Person picker entries: everyone, the system, then the people active in the period (busiest
// first) and the picked person even when they did nothing in it.
function personOptions(summary, lookups, picked, t) {
    const options = [{ key: 'all', name: t('Everyone') }];
    const seen = new Set();
    for (const row of summary?.people ?? []) {
        const key = row.actor_id ?? 'system';
        seen.add(key);
        const profile = lookups?.people?.get(row.actor_id);
        options.push({ key, name: row.actor_id ? profile?.name || row.name : t('System'), count: row.count, kind: row.actor_id ? profile?.kind ?? row.role : null, profile });
    }
    if (!seen.has('system')) options.splice(1, 0, { key: 'system', name: t('System'), count: 0 });
    if (picked && !seen.has(picked) && picked !== 'system') {
        const profile = lookups?.people?.get(picked);
        options.push({ key: picked, name: profile?.name ?? t('Someone'), count: 0, kind: profile?.kind, profile });
    }
    return options;
}

const PersonOption = ({ option }) => (
    <span className="alogOption">
        {option.key === 'all' ? (
            <span className="alogOptionIcon" aria-hidden="true">
                <LuUsers />
            </span>
        ) : option.key === 'system' ? (
            <span className="alogOptionIcon" aria-hidden="true">
                <LuCpu />
            </span>
        ) : (
            <Avatar {...AVATAR_DEFAULTS} size="sm" className="alogOptionAvatar" src={avatarUrl(option.profile?.avatar_path, option.profile?.updated_at) ?? undefined} name={option.name} />
        )}
        <span className="alogOptionName">{option.name}</span>
        {option.kind && <RoleChip kind={option.kind} className="alogOptionRole" />}
        {option.count !== undefined && <span className="segCount">{option.count}</span>}
    </span>
);

const PersonSelect = ({ options, value, onChange }) => {
    const { t } = useI18n();
    return (
        <Select
            size="sm"
            label={t('Person')}
            className="alogPersonSelect"
            items={options}
            selectedKeys={[value ?? 'all']}
            disallowEmptySelection
            onSelectionChange={(keys) => {
                const key = [...keys][0];
                onChange(!key || key === 'all' ? null : String(key));
            }}
            renderValue={(items) => items.map((item) => <PersonOption key={item.key} option={{ ...item.data, count: undefined, kind: undefined }} />)}
            // Wider than the trigger, so names and role chips fit.
            popoverProps={{ className: 'alogPersonPopover' }}
            classNames={{ popoverContent: 'adminPortal' }}
        >
            {(option) => (
                <SelectItem key={option.key} textValue={option.name}>
                    <PersonOption option={option} />
                </SelectItem>
            )}
        </Select>
    );
};

const ActionSelect = ({ area, summary, value, onChange, showCounts }) => {
    const { t } = useI18n();
    const counts = new Map((summary?.actions ?? []).filter((row) => row.area === area).map((row) => [row.action, row.count]));
    const options = Object.entries(ACTIONS[area] ?? {}).filter(([key]) => counts.has(key) || key === value);
    return (
        <Select
            size="sm"
            label={t('Action type')}
            className="alogActionSelect"
            selectedKeys={[value ?? 'all']}
            disallowEmptySelection
            onChange={(event) => onChange(!event.target.value || event.target.value === 'all' ? null : event.target.value)}
            classNames={{ popoverContent: 'adminPortal' }}
        >
            {[
                <SelectItem key="all" textValue={t('Any action')}>
                    {t('Any action')}
                </SelectItem>,
                ...options.map(([key, label]) => (
                    <SelectItem key={key} textValue={t(label)}>
                        <span className="alogOption">
                            <span className="alogOptionName">{t(label)}</span>
                            {showCounts && counts.has(key) && <span className="segCount">{counts.get(key)}</span>}
                        </span>
                    </SelectItem>
                )),
            ]}
        </Select>
    );
};

// The filter row above the feed (person, action type, search, clear). On phones the pickers move
// into a sheet behind a "Filters" button; search stays in the row.
const ActivityToolbar = ({ filters, search, onSearch, summary, lookups, narrowed, sheetCount, filtered, chips, onFilter, onClear }) => {
    const { t } = useI18n();
    const [sheet, setSheet] = useState(false);
    const options = personOptions(summary, lookups, filters.person, t);

    const pickers = (
        <>
            <PersonSelect options={options} value={filters.person} onChange={(person) => onFilter({ person })} />
            {filters.area && <ActionSelect area={filters.area} summary={summary} value={filters.action} showCounts={!narrowed} onChange={(action) => onFilter({ action })} />}
        </>
    );

    return (
        <div className="alogToolbar">
            <div className="alogToolbarRow">
                <div className="alogPickers">{pickers}</div>
                <Input
                    isClearable
                    size="sm"
                    aria-label={t('Search activity')}
                    placeholder={t('Search names, classes…')}
                    className="alogSearch"
                    startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                    value={search}
                    onValueChange={onSearch}
                    onClear={() => onSearch('')}
                />
                <Button className="alogFiltersButton" variant="flat" startContent={<LuSlidersHorizontal aria-hidden="true" />} onPress={() => setSheet(true)}>
                    {t('Filters')}
                    {sheetCount > 0 && <span className="segCount">{sheetCount}</span>}
                </Button>
                {filtered && (
                    <Button className="alogClear" variant="light" startContent={<LuX aria-hidden="true" />} onPress={onClear}>
                        {t('Clear filters')}
                    </Button>
                )}
            </div>
            {chips.length > 0 && (
                <div className="alogActiveChips">
                    {chips.map((chip) => (
                        <button key={chip.key} type="button" className="alogChip" aria-label={t('Remove filter: {name}', { name: chip.label })} onClick={chip.onRemove}>
                            {chip.label}
                            <LuX aria-hidden="true" />
                        </button>
                    ))}
                </div>
            )}

            <Modal isOpen={sheet} onOpenChange={setSheet} placement="bottom" scrollBehavior="inside" classNames={{ base: 'alogSheet adminPortal' }}>
                <ModalContent>
                    {(close) => (
                        <>
                            <ModalHeader>{t('Filters')}</ModalHeader>
                            <ModalBody>
                                <div className="alogSheetBody">
                                    <PersonSelect options={options} value={filters.person} onChange={(person) => onFilter({ person })} />
                                    <AreaChips summary={summary} area={filters.area} showCounts={!narrowed} onArea={(area) => onFilter({ area })} />
                                    {filters.area && (
                                        <ActionSelect area={filters.area} summary={summary} value={filters.action} showCounts={!narrowed} onChange={(action) => onFilter({ action })} />
                                    )}
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                {filtered && (
                                    <Button variant="light" startContent={<LuX aria-hidden="true" />} onPress={onClear}>
                                        {t('Clear filters')}
                                    </Button>
                                )}
                                <Button color="danger" onPress={close}>
                                    {t('Show results')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default ActivityToolbar;
