import { useState } from 'react';
import { Modal, Button, ModalHeader, ModalBody, ModalFooter, ModalContent } from '@nextui-org/react';
import { checkIn, checkOut } from '@/services/attendance';
import { useToast } from '@/ui/feedback/toastContext';
import ImagePicker from '@/ui/ImagePicker';

const COPY = {
    checkin: { title: 'Check In', action: 'Check In', done: 'Checked in. Have a great class!' },
    checkout: { title: 'Check Out', action: 'Check Out', done: 'Checked out. Thank you!' },
};

// Photo proof is required; the check-in/out time is recorded by the server.
const CheckForm = ({ kind, attendance, instructorName, onClose, onDone }) => {
    const toast = useToast();
    const [proof, setProof] = useState(null);
    const [saving, setSaving] = useState(false);
    const copy = COPY[kind];

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await (kind === 'checkin' ? checkIn : checkOut)(attendance, proof);
            toast.success(copy.done);
            onDone();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>{copy.title}</ModalHeader>
                <ModalBody>
                    <p>Class: {attendance.class?.name}</p>
                    <p>Instructor: {instructorName}</p>
                    <p>Room: {attendance.room?.name ?? '—'}</p>
                    <ImagePicker label="Take or upload a proof photo" capture="environment" onChange={setProof} isDisabled={saving} />
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!proof}>
                        {copy.action}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CheckForm;
