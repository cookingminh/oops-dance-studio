import { DateInput } from '@nextui-org/react';
import { parseDate } from '@internationalized/date';

function toCalendarDate(value) {
    if (!value) return null;
    try {
        return parseDate(value);
    } catch {
        return null;
    }
}

// Date input bound to an ISO 'yyyy-MM-dd' string ('' when empty).
const DateField = ({ label, value, onChange, ...props }) => (
    <DateInput
        label={label}
        value={toCalendarDate(value)}
        onChange={(date) => onChange(date ? date.toString() : '')}
        {...props}
    />
);

export default DateField;
