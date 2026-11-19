import { AnimatePresence, motion } from 'framer-motion';
import { LuSparkles, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { initialOf, senderLabel } from './supportText';

// A studio reply that arrived while the chat is closed, next to the bubble (where the invitation sits):
// who wrote it and the first lines. Clicking it opens the chat; × puts it away (the badge stays).
const SupportPreview = ({ message, onOpen, onDismiss }) => {
    const { t } = useI18n();
    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    key={message.id}
                    className="supportPreview"
                    role="status"
                    initial={{ opacity: 0, x: 18, y: 6, scale: 0.92 }}
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 12, scale: 0.95, transition: { duration: 0.16 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                >
                    <button type="button" className="supportTeaserBody" onClick={onOpen}>
                        <span className={`supportAvatar${message.sender_kind === 'ai' ? ' isAi' : ''}`} aria-hidden="true">
                            {message.sender_kind === 'ai' ? <LuSparkles /> : initialOf(message.sender_name)}
                        </span>
                        <span className="supportTeaserText">
                            <span className="supportTeaserFrom">{senderLabel(t, message)}</span>
                            <span className="supportTeaserLine supportPreviewLine">{message.body || t('Sent a photo')}</span>
                        </span>
                    </button>
                    <button type="button" className="supportTeaserClose" onClick={onDismiss} aria-label={t('Hide this message')} title={t('Hide this message')}>
                        <LuX aria-hidden="true" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SupportPreview;
