import { Select, SelectItem } from '@nextui-org/react';
import { LEVELS, NO_LEVEL, levelOf } from '@/lib/classLevel';
import { useI18n } from '@/i18n/i18nContext';

const POPOVER = { popoverContent: 'adminPortal' };
const NONE = 'none';
const OPTIONS = [{ ...NO_LEVEL, value: NONE }, ...LEVELS];

// The level's colour, as the website timetable shows it (inline: the field also sits in dialogs outside the shell).
export const LevelDot = ({ value }) => (
    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: levelOf(value).color }} aria-hidden="true" />
);

// A class's level (lib/classLevel.js; '' = none): what colours it on the website's poster timetable.
const LevelField = ({ value, onChange, isDisabled = false, className }) => {
    const { t } = useI18n();
    return (
        <Select
            label={t('Level')}
            classNames={POPOVER}
            className={className}
            isDisabled={isDisabled}
            selectedKeys={[value || NONE]}
            disallowEmptySelection
            onChange={(event) => onChange(event.target.value === NONE ? '' : event.target.value)}
            description={t('Colours the class on the website timetable.')}
            startContent={<LevelDot value={value || null} />}
        >
            {OPTIONS.map((level) => (
                <SelectItem key={level.value} textValue={t(level.label)} startContent={<LevelDot value={level.value === NONE ? null : level.value} />}>
                    {t(level.label)}
                </SelectItem>
            ))}
        </Select>
    );
};

export default LevelField;
