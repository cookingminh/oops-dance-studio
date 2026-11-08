// Segmented control: one of `options` ({ key, label, count?, color? }) is selected.
const Segmented = ({ label, options, value, onChange, className = '' }) => (
    <div className={`segmented ${className}`} role="group" aria-label={label}>
        {options.map((option) => (
            <button key={option.key} type="button" aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
                {option.color && <span className="segDot" style={{ background: option.color }} aria-hidden="true" />}
                {option.label}
                {option.count !== undefined && <span className="segCount">{option.count}</span>}
            </button>
        ))}
    </div>
);

export default Segmented;
