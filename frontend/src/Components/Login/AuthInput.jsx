// One labelled input row of the login / register / reset-password forms.
const AuthInput = ({ id, label, icon: Icon, ...inputProps }) => (
    <div className="inputDiv">
        <label htmlFor={id}>{label}</label>
        <div className="input flex">
            <Icon className="icon" aria-hidden="true" />
            <input id={id} {...inputProps} />
        </div>
    </div>
);

export default AuthInput;
