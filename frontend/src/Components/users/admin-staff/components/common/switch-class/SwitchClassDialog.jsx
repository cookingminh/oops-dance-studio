import { Avatar, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SwitchClassForm from './SwitchClassForm';
import './switchClass.scss';

// Move a student to another class (Students page, Tuition page). `student` { id, name,
// avatar_path?, updated_at? }, `fromClass` { id, name }. onSwitched(newInvoice, toClass) after it
// worked; the parent closes the dialog and reloads what it shows.
const SwitchClassDialog = ({ student, fromClass, onClose, onSwitched }) => {
    const { t } = useI18n();
    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="2xl"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'swDialog adminPortal' }}
        >
            <ModalContent>
                <ModalHeader className="swHead">
                    <Avatar {...AVATAR_DEFAULTS} size="md" src={avatarUrl(student.avatar_path, student.updated_at) ?? undefined} name={student.name} />
                    <span className="swHeadText">
                        <span className="swEyebrow">{t('Switch class')}</span>
                        <strong>{student.name}</strong>
                        <small>{t('Now in {className}', { className: fromClass.name })}</small>
                    </span>
                </ModalHeader>
                <SwitchClassForm student={student} fromClass={fromClass} Body={ModalBody} Footer={ModalFooter} onCancel={onClose} onSwitched={onSwitched} />
            </ModalContent>
        </Modal>
    );
};

export default SwitchClassDialog;
