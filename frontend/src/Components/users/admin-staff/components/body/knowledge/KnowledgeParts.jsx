import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuBadgeCheck, LuFileEdit, LuFileText, LuLightbulb } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { CATEGORY_ICONS, STATUSES } from './knowledgeModel';

export const CategoryIcon = ({ category }) => {
    const Icon = CATEGORY_ICONS[category] ?? LuFileText;
    return (
        <span className="kbIcon" aria-hidden="true">
            <Icon />
        </span>
    );
};

export const StatusPill = ({ status }) => {
    const { t } = useI18n();
    const Icon = status === 'published' ? LuBadgeCheck : LuFileEdit;
    return (
        <span className={`kbPill is-${status}`}>
            <Icon aria-hidden="true" />
            {t(STATUSES[status]?.pill ?? status)}
        </span>
    );
};

// Throwing away text that isn't saved anywhere else.
export const DiscardDialog = ({ isNew, onClose, onDiscard }) => {
    const { t } = useI18n();
    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'adminPortal kbDialog' }}>
            <ModalContent>
                <ModalHeader>{t('Discard what isn’t saved?')}</ModalHeader>
                <ModalBody>
                    <p>{isNew ? t('This unsaved draft is gone for good.') : t('The article goes back to what is saved.')}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="flat" onPress={onClose}>
                        {t('Keep it')}
                    </Button>
                    <Button color="danger" onPress={onDiscard}>
                        {t('Discard it')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

const TIPS = [
    'One topic per article.',
    'Short, factual sentences.',
    'Only real prices and real rules.',
    'Customers may read this: nothing private or internal.',
];

// How to write for the assistant.
export const WritingTips = () => {
    const { t } = useI18n();
    return (
        <aside className="kbTips" aria-label={t('Writing for the assistant')}>
            <strong>
                <LuLightbulb aria-hidden="true" />
                {t('Writing for the assistant')}
            </strong>
            <ul>
                {TIPS.map((tip) => (
                    <li key={tip}>{t(tip)}</li>
                ))}
            </ul>
        </aside>
    );
};
