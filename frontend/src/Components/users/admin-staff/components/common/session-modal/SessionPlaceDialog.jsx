import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { classFreeRooms, placeClassSessions } from '@/services/classes';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';

const UNPLACED = 'none';

// One session's room for that day alone: one of the studio rooms free then (class_free_rooms), or none yet (a to-do
// for staff until it is placed). The class's other sessions and its own place don't change.
const SessionPlaceDialog = ({ cls, date, current, onClose, onPlaced }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const free = useAsync(() => classFreeRooms(cls.id, date), [cls.id, date]);
    const [choice, setChoice] = useState(current ? String(current) : '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await placeClassSessions(cls.id, [{ date, room_id: choice === UNPLACED ? null : Number(choice) }]);
            toast.success(choice === UNPLACED ? 'The session has no room for now: it is on the to-do list.' : 'Room set for this session.');
            onPlaced();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen size="md" onOpenChange={(open) => !open && !saving && onClose()} classNames={{ base: 'adminPortal' }}>
            <ModalContent>
                <ModalHeader className="flex-col items-start gap-1">
                    {t('Room for this session')}
                    <span className="text-sm font-normal text-default-500">
                        {cls.name} · {formatDate(date, 'full')}
                    </span>
                </ModalHeader>
                <ModalBody>
                    {free.loading ? (
                        <p className="text-sm text-default-500">{t('Loading…')}</p>
                    ) : (
                        <RadioGroup label={t('Free at the class’s time that day')} value={choice} onValueChange={setChoice}>
                            {(free.data ?? []).map((room) => (
                                <Radio key={room.id} value={String(room.id)}>
                                    {room.name}
                                </Radio>
                            ))}
                            <Radio value={UNPLACED} description={t('It stays on the to-do list until someone places it.')}>
                                {t('No room yet')}
                            </Radio>
                        </RadioGroup>
                    )}
                    {free.data && free.data.length === 0 && <p className="text-sm text-default-500">{t('No studio room is free then.')}</p>}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" onPress={save} isLoading={saving} isDisabled={!choice}>
                        {t('Save')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default SessionPlaceDialog;
