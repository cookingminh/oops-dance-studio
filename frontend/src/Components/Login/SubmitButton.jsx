import { LuArrowRight, LuLoader2 } from 'react-icons/lu';

// The red full-width button of each form; a spinner and `busyLabel` while it works.
const SubmitButton = ({ busy, disabled, busyLabel, children }) => (
    <button type="submit" className="authSubmit" disabled={busy || disabled} aria-busy={busy}>
        <span>{busy ? busyLabel : children}</span>
        {busy ? <LuLoader2 className="authSpin" aria-hidden="true" /> : <LuArrowRight className="authArrow" aria-hidden="true" />}
    </button>
);

export default SubmitButton;
