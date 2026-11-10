import { useState } from 'react';
import { Modal, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Image } from '@nextui-org/react';
import { setClassImage } from '@/services/classes';
import { classImageUrl } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import ImagePicker from '@/ui/ImagePicker';

const ChangeClassImageForm = ({ classRow, onClose, onSaved }) => {
    const toast = useToast();
    const { t } = useI18n();
    const [image, setImage] = useState(null);
    const [saving, setSaving] = useState(false);
    const current = classImageUrl(classRow.image_path);

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await setClassImage(classRow, image);
            toast.success('Class image updated.');
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>{t('Change image — {name}', { name: classRow.name })}</ModalHeader>
                <ModalBody>
                    {current && <Image src={current} alt={classRow.name} className="max-h-60 object-cover" />}
                    <ImagePicker label={t('Choose New Image')} onChange={setImage} isDisabled={saving} />
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" onPress={handleSubmit} isLoading={saving} isDisabled={!image}>
                        {t('Change Image')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ChangeClassImageForm;
