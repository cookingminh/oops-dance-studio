import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuAlertCircle, LuCheck, LuCheckCircle2, LuRotateCcw } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';

// Footer of the details form. Quiet while nothing changed; with unsaved changes it lifts and sticks
// to the bottom of the screen (while the form is in view) with Discard and Save.
// Save Changes is always there (disabled until something changed) so its place never moves.
// `blocked`: there are changes, but a field needs fixing first.
const SaveBar = ({ dirty, blocked, saving, canSave, justSaved, onDiscard }) => {
    const { t } = useI18n();

    let status;
    if (dirty && blocked) {
        status = (
            <motion.span key="blocked" className="saveState isBlocked" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <LuAlertCircle aria-hidden="true" />
                {t('Check the highlighted fields')}
            </motion.span>
        );
    } else if (dirty) {
        status = (
            <motion.span key="dirty" className="saveState isDirty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="pulseDot" aria-hidden="true" />
                {t('You have unsaved changes')}
            </motion.span>
        );
    } else if (justSaved) {
        status = (
            <motion.span key="saved" className="saveState isSaved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.span
                    className="savedIcon"
                    initial={{ scale: 0.4, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                >
                    <LuCheckCircle2 aria-hidden="true" />
                </motion.span>
                {t('Saved')}
            </motion.span>
        );
    } else {
        status = (
            <motion.span key="clean" className="saveState" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <LuCheck aria-hidden="true" />
                {t('No unsaved changes')}
            </motion.span>
        );
    }

    return (
        <div className={`saveBar${dirty ? ' isDirty' : ''}`}>
            <p className="saveStatus" aria-live="polite">
                {status}
            </p>
            <div className="saveActions">
                <AnimatePresence initial={false}>
                    {dirty && (
                        <motion.span key="discard" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.18 }}>
                            <Button variant="light" startContent={<LuRotateCcw aria-hidden="true" />} onPress={onDiscard} isDisabled={saving}>
                                {t('Discard')}
                            </Button>
                        </motion.span>
                    )}
                </AnimatePresence>
                <Button type="submit" color="danger" isLoading={saving} isDisabled={!canSave}>
                    {t('Save Changes')}
                </Button>
            </div>
        </div>
    );
};

export default SaveBar;
