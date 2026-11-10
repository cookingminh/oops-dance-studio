import { AnimatePresence, motion } from 'framer-motion';
import { LuAlertCircle } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';

// The form's error line ({ text, vars } from toAlert). The role="alert" box is always in the page
// so screen readers announce what appears in it; the message slides in with a small shake.
const FormAlert = ({ alert }) => {
    const { t } = useI18n();
    return (
        <div role="alert" className="authAlertSlot">
            <AnimatePresence initial={false}>
                {alert && (
                    <motion.div
                        key={alert.text}
                        className="showMessage authAlert"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0, x: [0, -6, 5, -3, 0] }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.34 }}
                    >
                        <LuAlertCircle aria-hidden="true" />
                        <span>{t(alert.text, alert.vars)}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FormAlert;
