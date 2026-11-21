import { AnimatePresence, motion } from 'framer-motion';
import { LuAlertCircle } from 'react-icons/lu';
import { SHAKE } from './authShared';

// One labelled field of the auth forms: icon, input, an optional control at the end (show
// password), then under it:
// - `error`: this field's message (translated text), announced and shaken in, the field turns red;
// - `meter`: a full-width strip (the password strength bars);
// - `hint` (`hintMet` turns it green with a tick) and `note` on the left, `aside` on the right
//   (e.g. "Forgot your password?").
// `describedBy` adds ids of other text about the field to its aria-describedby.
const AuthInput = ({ id, label, icon: Icon, end, hint, hintMet = false, error, meter, note, aside, describedBy, ...inputProps }) => {
    const described = [error && `${id}-error`, hint && `${id}-hint`, describedBy].filter(Boolean).join(' ');
    return (
        <div className={`authField${error ? ' is-invalid' : ''}`}>
            <label htmlFor={id}>{label}</label>
            <div className="authInput">
                <Icon className="authInputIcon" aria-hidden="true" />
                <input id={id} aria-invalid={error ? true : undefined} aria-describedby={described || undefined} {...inputProps} />
                {end}
            </div>
            <div id={`${id}-error`} role="alert" className="authFieldErrorSlot">
                <AnimatePresence initial={false}>
                    {error && (
                        <motion.p key={error} className="showMessage authFieldError" {...SHAKE}>
                            <LuAlertCircle aria-hidden="true" />
                            <span>{error}</span>
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
            {meter}
            {(hint || note || aside) && (
                <div className="authFieldFoot">
                    <div className="authFieldNotes">
                        {hint && (
                            <p id={`${id}-hint`} className={`authHint${hintMet ? ' is-met' : ''}`}>
                                {hint}
                            </p>
                        )}
                        {note}
                    </div>
                    {aside}
                </div>
            )}
        </div>
    );
};

export default AuthInput;
