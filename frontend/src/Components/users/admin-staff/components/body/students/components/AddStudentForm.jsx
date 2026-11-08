import { useState } from 'react';
import { Modal, Button, ModalHeader, ModalBody, ModalFooter, ModalContent } from '@nextui-org/react';
import { addStudent } from '@/services/classes';
import { useToast } from '@/ui/feedback/toastContext';
import PersonAutocomplete from '@/ui/PersonAutocomplete';

// Enrols one guest in `classRow`. Guests already in the class are not offered.
const AddStudentForm = ({ classRow, guests, onClose, onSaved }) => {
    const toast = useToast();
    const [studentId, setStudentId] = useState(null);
    const [saving, setSaving] = useState(false);
    const enrolled = new Set(classRow.students.map((row) => row.student?.id));
    const candidates = guests.filter((guest) => !enrolled.has(guest.id));

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await addStudent(classRow.id, studentId);
            toast.success('Student added to the class.');
            onSaved();
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'This student is already in the class.' : error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>Add a student to {classRow.name}</ModalHeader>
                <ModalBody>
                    <PersonAutocomplete label="Student" people={candidates} value={studentId} onChange={setStudentId} isRequired />
                    {candidates.length === 0 && <p className="text-sm text-default-500">Every guest is already enrolled.</p>}
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!studentId}>
                        Add Student
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default AddStudentForm;
