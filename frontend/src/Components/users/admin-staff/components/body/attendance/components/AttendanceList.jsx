import { useState } from 'react';
import {
    Button,
    DropdownTrigger,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Textarea,
    Select,
    SelectItem,
} from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import {
    INSTRUCTOR_ATTENDANCE_STATUSES,
    generateInstructorAttendance,
    listInstructorAttendance,
    updateInstructorAttendance,
} from '@/services/attendance';
import { listInstructors } from '@/services/users';
import { avatarUrl } from '@/services/storage';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../Table/TableTemplate';
import { VerticalDotsIcon } from '../../../../../../Table/VerticalDotsIcon';

const INITIAL_VISIBLE_COLUMNS = ['date', 'user', 'class_name', 'checkin_time', 'checkin_proof', 'checkout_time', 'checkout_proof', 'status', 'details', 'actions'];

const columns = [
    { name: 'Date', uid: 'date', allowsSorting: true },
    { name: 'Instructor', uid: 'user', allowsSorting: true },
    { name: 'Class Name', uid: 'class_name', allowsSorting: true },
    { name: 'Room', uid: 'room' },
    { name: 'Check-in', uid: 'checkin_time' },
    { name: 'Check-in Proof', uid: 'checkin_proof' },
    { name: 'Check-out', uid: 'checkout_time' },
    { name: 'Check-out Proof', uid: 'checkout_proof' },
    { name: 'Status', uid: 'status', allowsSorting: true },
    { name: 'Details', uid: 'details' },
    { name: 'Actions', uid: 'actions' },
];

const statusOptions = INSTRUCTOR_ATTENDANCE_STATUSES.map((status) => ({ uid: status, name: status.replace('_', ' ') }));

const AttendanceList = () => {
    const toast = useToast();
    const records = useAsync(() => listInstructorAttendance({ withProofs: true }), []);
    const instructors = useAsync(listInstructors, []);
    const [dialog, setDialog] = useState(null); // { type: 'details' | 'instructor', record }
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const save = async (record, fields, message) => {
        setBusy(true);
        try {
            await updateInstructorAttendance(record.id, fields);
            toast.success(message);
            setDialog(null);
            records.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
        }
    };

    const handleGenerate = async () => {
        setBusy(true);
        try {
            const created = await generateInstructorAttendance();
            toast.success(created > 0 ? `Created ${created} records for this week.` : 'This week’s records already exist.');
            records.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
        }
    };

    const openDialog = (type, record) => {
        setDraft(type === 'details' ? record.details ?? '' : record.instructor_id);
        setDialog({ type, record });
    };

    const renderActions = (item) => {
        const { record } = item;
        const actions = [];
        if (record.status !== 'completed') {
            actions.push(
                <DropdownItem key="approve" onPress={() => save(record, { status: 'completed' }, 'Marked as completed.')}>
                    Approve (completed)
                </DropdownItem>
            );
        }
        if (record.status !== 'cancelled') {
            actions.push(
                <DropdownItem
                    key="cancel"
                    className="text-danger"
                    color="danger"
                    onPress={() => window.confirm('Cancel this session?') && save(record, { status: 'cancelled' }, 'Session cancelled.')}
                >
                    Cancel
                </DropdownItem>
            );
        }
        actions.push(<DropdownItem key="details" onPress={() => openDialog('details', record)}>Add details</DropdownItem>);
        if (record.status === 'pending') {
            actions.push(<DropdownItem key="instructor" onPress={() => openDialog('instructor', record)}>Change instructor</DropdownItem>);
        }
        return (
            <Dropdown>
                <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" aria-label="Attendance actions">
                        <VerticalDotsIcon className="text-default-300" />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Attendance actions">{actions}</DropdownMenu>
            </Dropdown>
        );
    };

    const rows = (records.data ?? []).map((record) => ({
        id: record.id,
        record,
        date: record.date,
        username: record.instructor?.full_name || record.instructor?.username,
        name: record.instructor?.full_name || record.instructor?.username,
        email: record.instructor?.email,
        user_avatar: avatarUrl(record.instructor?.avatar_path, record.instructor?.updated_at),
        class_name: record.class?.name,
        room: record.room?.name ?? '',
        checkin_time: formatDateTime(record.checkin_at),
        checkout_time: formatDateTime(record.checkout_at),
        checkin_proof: record.checkin_proof_url,
        checkout_proof: record.checkout_proof_url,
        status: record.status,
        details: record.details ?? '',
    }));

    return (
        <div className="attendanceAdmin flex">
            <div className="flex flex-col gap-4 sectionContainer">
                <div className="header flex flex-col gap-4">
                    <h1 className="text-3xl font-bold">All Records</h1>
                    <div className="flex gap-4 items-center font-semibold">
                        <h1>Create this week’s attendance records</h1>
                        <Button onPress={handleGenerate} isLoading={busy && !dialog}>Create</Button>
                    </div>
                </div>

                <div className="tableDiv">
                    <AsyncState state={records} isEmpty={false}>
                        <TableTemplate
                            ariaLabel="Instructor attendance"
                            columns={columns}
                            data={rows}
                            statusOptions={statusOptions}
                            initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                            renderActions={renderActions}
                        />
                    </AsyncState>
                </div>
            </div>

            <Modal isOpen={dialog?.type === 'details'} onOpenChange={(open) => !open && setDialog(null)}>
                <ModalContent>
                    <ModalHeader>Add Details</ModalHeader>
                    <ModalBody>
                        <Textarea label="Details" placeholder="Enter details" value={draft} onValueChange={setDraft} />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setDialog(null)}>Close</Button>
                        <Button color="primary" isLoading={busy} onPress={() => save(dialog.record, { details: draft }, 'Details saved.')}>
                            Save Details
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={dialog?.type === 'instructor'} onOpenChange={(open) => !open && setDialog(null)}>
                <ModalContent>
                    <ModalHeader>Change Instructor</ModalHeader>
                    <ModalBody>
                        <Select
                            label="New Instructor"
                            placeholder="Select new instructor"
                            selectedKeys={draft ? [draft] : []}
                            onChange={(event) => setDraft(event.target.value)}
                        >
                            {(instructors.data ?? []).map((person) => (
                                <SelectItem key={person.id}>{person.full_name || person.username}</SelectItem>
                            ))}
                        </Select>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setDialog(null)}>Close</Button>
                        <Button
                            color="primary"
                            isLoading={busy}
                            isDisabled={!draft || draft === dialog?.record.instructor_id}
                            onPress={() => save(dialog.record, { instructorId: draft }, 'Instructor changed.')}
                        >
                            Change Instructor
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default AttendanceList;
