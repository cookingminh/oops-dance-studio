import { AnimatePresence, motion } from 'framer-motion';
import { LuAlertCircle } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { SHAKE } from './authShared';

// The form's error line ({ text, vars } from toAlert), above the form. The role="alert" box is
// always in the page so screen readers announce what appears in it; the message slides in with a
// small shake. A message for one field (`alert.field`) shows under that field instead.
const FormAlert = ({ alert }) => {
    const { t } = useI18n();
    const shown = alert && !alert.field ? alert : null;
    return (
        <div role="alert" className="authAlertSlot">
            <AnimatePresence initial={false}>
                {shown && (
                    <motion.div key={shown.text} className="showMessage authAlert" {...SHAKE}>
                        <LuAlertCircle aria-hidden="true" />
                        <span>{t(shown.text, shown.vars)}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FormAlert;
