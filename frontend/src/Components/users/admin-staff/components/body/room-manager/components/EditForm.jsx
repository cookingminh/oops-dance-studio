import { useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent } from '@nextui-org/react';
import { updateRoom } from '@/services/rooms';
import { useToast } from '@/ui/feedback/toastContext';

const EditForm = ({ room, onClose, onSaved }) => {
    const toast = useToast();
    const [form, setForm] = useState({ name: room.name, size: room.size ?? '', price: String(room.price) });
    const [saving, setSaving] = useState(false);

    const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
    const priceInvalid = form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0;

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await updateRoom(room.id, form);
            toast.success('Room updated.');
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
                <ModalHeader>Edit Room</ModalHeader>
                <ModalBody>
                    <Input label="Room Name" isRequired value={form.name} onValueChange={update('name')} />
                    <Input label="Room Size" placeholder="e.g. 80 m²" value={form.size} onValueChange={update('size')} />
                    <Input
                        label="Price per hour (VND)"
                        type="number"
                        min={0}
                        step={1000}
                        isRequired
                        value={form.price}
                        onValueChange={update('price')}
                        isInvalid={priceInvalid}
                        errorMessage={priceInvalid ? 'Enter a price of 0 or more.' : undefined}
                    />
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!form.name.trim() || priceInvalid}>
                        Update Room
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default EditForm;
