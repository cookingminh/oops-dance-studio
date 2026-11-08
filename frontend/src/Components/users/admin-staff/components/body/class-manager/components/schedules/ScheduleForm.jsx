import { useState } from 'react';
import { Modal, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem } from '@nextui-org/react';
import { createSchedule, updateSchedule } from '@/services/schedules';
import { TIME_OPTIONS, WEEKDAYS, formatTime, toMinutes } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';

// Existing sessions may start off the half-hour grid (e.g. 19:45); keep that value selectable.
const withCurrent = (options, value) => (value && !options.includes(value) ? [...options, value].sort() : options);

// Create or edit one weekly session of a class. Weekdays are ISO (1 = Monday … 7 = Sunday).
const ScheduleForm = ({ schedule, classes, onClose, onSaved }) => {
    const toast = useToast();
    const isNew = !schedule;
    const [form, setForm] = useState({
        classId: schedule ? String(schedule.class_id) : '',
        dayOfWeek: schedule ? String(schedule.day_of_week) : '',
        startTime: formatTime(schedule?.start_time),
        endTime: formatTime(schedule?.end_time),
    });
    const [saving, setSaving] = useState(false);

    const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    const timeError = form.startTime && form.endTime && toMinutes(form.startTime) >= toMinutes(form.endTime)
        ? 'End time must be after start time.'
        : '';
    const canSave = form.classId && form.dayOfWeek && form.startTime && form.endTime && !timeError;

    const handleSubmit = async () => {
        setSaving(true);
        const fields = {
            classId: Number(form.classId),
            dayOfWeek: Number(form.dayOfWeek),
            startTime: form.startTime,
            endTime: form.endTime,
        };
        try {
            if (isNew) await createSchedule(fields);
            else await updateSchedule(schedule.id, fields);
            toast.success(isNew ? 'Schedule added.' : 'Schedule updated.');
            onSaved();
        } catch (error) {
            // The room is shared with bookings and other classes; say what it clashes with.
            if (error.code === 'SLOT_TAKEN' && error.detail) toast.error(`That time isn’t free in this class’s room: ${error.detail}.`);
            else toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>{isNew ? 'Add Schedule' : 'Edit Schedule'}</ModalHeader>
                <ModalBody>
                    <Select
                        label="Class"
                        isRequired
                        placeholder={classes.length ? 'Select a class' : 'Add a class first'}
                        selectedKeys={form.classId ? [form.classId] : []}
                        onChange={set('classId')}
                    >
                        {classes.map((item) => (
                            <SelectItem key={String(item.id)}>{item.name}</SelectItem>
                        ))}
                    </Select>
                    <Select label="Day of the Week" isRequired selectedKeys={form.dayOfWeek ? [form.dayOfWeek] : []} onChange={set('dayOfWeek')}>
                        {WEEKDAYS.map((day) => (
                            <SelectItem key={String(day.value)}>{day.label}</SelectItem>
                        ))}
                    </Select>
                    <Select label="Start Time" isRequired selectedKeys={form.startTime ? [form.startTime] : []} onChange={set('startTime')}>
                        {withCurrent(TIME_OPTIONS.slice(0, -1), form.startTime).map((time) => (
                            <SelectItem key={time}>{time}</SelectItem>
                        ))}
                    </Select>
                    <Select
                        label="End Time"
                        isRequired
                        selectedKeys={form.endTime ? [form.endTime] : []}
                        onChange={set('endTime')}
                        isInvalid={Boolean(timeError)}
                        errorMessage={timeError || undefined}
                    >
                        {withCurrent(TIME_OPTIONS.slice(1), form.endTime).map((time) => (
                            <SelectItem key={time}>{time}</SelectItem>
                        ))}
                    </Select>
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!canSave}>
                        {isNew ? 'Add Schedule' : 'Update Schedule'}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ScheduleForm;
