import { useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem, Avatar } from '@nextui-org/react';
import { createClass, updateClass } from '@/services/classes';
import { avatarUrl } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';
import ImagePicker from '@/ui/ImagePicker';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

// Create or edit a class. Schedules are managed separately (each schedule belongs to one class).
const ClassForm = ({ classRow, instructors, rooms, onClose, onSaved }) => {
    const toast = useToast();
    const isNew = !classRow;
    const [form, setForm] = useState({
        name: classRow?.name ?? '',
        instructorId: classRow?.instructor_id ?? '',
        roomId: classRow?.room_id ? String(classRow.room_id) : '',
        price: classRow ? String(classRow.price) : '',
    });
    const [image, setImage] = useState(null);
    const [saving, setSaving] = useState(false);

    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
    const priceInvalid = form.price !== '' && (Number.isNaN(Number(form.price)) || Number(form.price) < 0);
    const canSave = form.name.trim() && form.instructorId && form.price !== '' && !priceInvalid;

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const fields = { ...form, roomId: form.roomId ? Number(form.roomId) : null };
            if (isNew) {
                await createClass(fields, image);
                toast.success('Class added. Add its weekly sessions and this month’s lesson next.');
            } else {
                await updateClass(classRow.id, fields);
                toast.success('Class updated.');
            }
            onSaved();
        } catch (error) {
            if (error.code === 'DUPLICATE') toast.error('A class with this name already exists.');
            // Moving a class to another room must not clash with that room's bookings or classes.
            else if (error.code === 'SLOT_TAKEN' && error.detail) toast.error(`That room isn’t free at this class’s times: ${error.detail}.`);
            else toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen scrollBehavior="inside" onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>{isNew ? 'Add New Class' : 'Edit Class'}</ModalHeader>
                <ModalBody>
                    <Input label="Class Name" isRequired value={form.name} onValueChange={set('name')} />
                    <Select
                        label="Instructor"
                        isRequired
                        placeholder={instructors.length ? 'Select an instructor' : 'No instructors yet'}
                        selectedKeys={form.instructorId ? [form.instructorId] : []}
                        onChange={(event) => set('instructorId')(event.target.value)}
                    >
                        {instructors.map((person) => (
                            <SelectItem
                                key={person.id}
                                textValue={person.full_name || person.username}
                                startContent={<Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={person.full_name} />}
                            >
                                {person.full_name || person.username}
                            </SelectItem>
                        ))}
                    </Select>
                    <Select
                        label="Room"
                        placeholder="Select a room"
                        selectedKeys={form.roomId ? [form.roomId] : []}
                        onChange={(event) => set('roomId')(event.target.value)}
                    >
                        {rooms.map((room) => (
                            <SelectItem key={String(room.id)}>{room.name}</SelectItem>
                        ))}
                    </Select>
                    <Input
                        label="Price (VND)"
                        type="number"
                        min={0}
                        step={1000}
                        isRequired
                        value={form.price}
                        onValueChange={set('price')}
                        isInvalid={priceInvalid}
                        errorMessage={priceInvalid ? 'Enter a price of 0 or more.' : undefined}
                    />
                    {isNew && <ImagePicker label="Upload Class Image (optional)" onChange={setImage} isDisabled={saving} />}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="danger" onPress={handleSubmit} isLoading={saving} isDisabled={!canSave}>
                        {isNew ? 'Add Class' : 'Update Class'}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ClassForm;
