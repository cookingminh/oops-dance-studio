// One labelled field of the auth forms: icon, input, an optional control at the end (show
// password) and an optional hint under it, tied to the input with aria-describedby.
// `hintMet` turns the hint green with a tick once the rule it states is satisfied.
const AuthInput = ({ id, label, icon: Icon, end, hint, hintMet = false, ...inputProps }) => (
    <div className="authField">
        <label htmlFor={id}>{label}</label>
        <div className="authInput">
            <Icon className="authInputIcon" aria-hidden="true" />
            <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...inputProps} />
            {end}
        </div>
        {hint && (
            <p id={`${id}-hint`} className={`authHint${hintMet ? ' is-met' : ''}`}>
                {hint}
            </p>
        )}
    </div>
);

export default AuthInput;
