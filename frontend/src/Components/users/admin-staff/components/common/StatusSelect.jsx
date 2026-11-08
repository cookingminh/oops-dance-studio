import { Select, SelectItem } from '@nextui-org/react';

const Dot = ({ color }) => <span className={`segDot${color ? '' : ' isAll'}`} style={color ? { background: color } : undefined} aria-hidden="true" />;

// Compact status filter: options are { key, label, count, color? }; 'all' is the "any status" choice.
const StatusSelect = ({ label = 'Status', options, value, onChange }) => (
    <Select
        aria-label={label}
        className="statusSelect"
        classNames={{ trigger: 'statusSelectTrigger', popoverContent: 'adminPortal' }}
        selectedKeys={[value]}
        disallowEmptySelection
        items={options}
        onChange={(event) => onChange(event.target.value || 'all')}
        renderValue={(items) =>
            items.map(({ key, data }) => (
                <span key={key} className="statusValue">
                    <Dot color={data.color} />
                    {data.label}
                    <span className="segCount">{data.count}</span>
                </span>
            ))
        }
    >
        {(option) => (
            <SelectItem key={option.key} textValue={option.label} startContent={<Dot color={option.color} />} endContent={<span className="segCount">{option.count}</span>}>
                {option.label}
            </SelectItem>
        )}
    </Select>
);

export default StatusSelect;
