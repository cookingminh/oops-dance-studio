import { useState } from 'react';
import { Modal, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Image } from '@nextui-org/react';
import { setClassImage } from '@/services/classes';
import { classImageUrl } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';
import ImagePicker from '@/ui/ImagePicker';

const ChangeClassImageForm = ({ classRow, onClose, onSaved }) => {
    const toast = useToast();
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
                <ModalHeader>Change image — {classRow.name}</ModalHeader>
                <ModalBody>
                    {current && <Image src={current} alt={classRow.name} className="max-h-60 object-cover" />}
                    <ImagePicker label="Choose New Image" onChange={setImage} isDisabled={saving} />
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="danger" onPress={handleSubmit} isLoading={saving} isDisabled={!image}>
                        Change Image
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ChangeClassImageForm;
