const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Month (1–12) and year selects used by the charts.
const MonthYearSelect = ({ month, year, onChange, years = 5 }) => {
    const currentYear = new Date().getFullYear();
    return (
        <div className="flex gap-4 mb-4 justify-center">
            <select
                aria-label="Month"
                className="p-2 border rounded"
                value={month}
                onChange={(event) => onChange({ month: Number(event.target.value), year })}
            >
                {MONTHS.map((label, index) => (
                    <option key={label} value={index + 1}>{label}</option>
                ))}
            </select>
            <select
                aria-label="Year"
                className="p-2 border rounded"
                value={year}
                onChange={(event) => onChange({ month, year: Number(event.target.value) })}
            >
                {Array.from({ length: years }, (_, index) => currentYear - index).map((value) => (
                    <option key={value} value={value}>{value}</option>
                ))}
            </select>
        </div>
    );
};

export default MonthYearSelect;
