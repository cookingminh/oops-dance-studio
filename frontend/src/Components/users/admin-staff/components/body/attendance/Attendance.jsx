import { useState } from 'react';
import { Button, Image, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { generateInstructorAttendance, listInstructorAttendance, updateInstructorAttendance } from '@/services/attendance';
import { listClasses } from '@/services/classes';
import { listInstructors } from '@/services/users';
import { getStudioToday } from '@/services/studio';
import { isoWeekdayOf } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { useStaffTasks } from '../../../tasks/staffTasks';
import ReviewQueue from './components/ReviewQueue';
import TodaySessions from './components/TodaySessions';
import AttendanceList from './components/AttendanceList';
import AttendanceChart from './components/AttendanceChart';
import { OPEN_STATUSES } from './components/sessionPhase';

// Instructor attendance, in the order staff deal with it: past sessions left open, today's
// sessions (who still has to check in or out), every session, and the monthly chart.
const Attendance = () => {
    const toast = useToast();
    const { refresh: refreshTasks } = useStaffTasks();
    const today = useAsync(getStudioToday, []);
    const records = useAsync(() => listInstructorAttendance({ withProofs: true }), []);
    const classes = useAsync(listClasses, []);
    const instructors = useAsync(listInstructors, []);

    const [dialog, setDialog] = useState(null); // { type: 'details' | 'instructor', record }
    const [draft, setDraft] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [proof, setProof] = useState(null); // { url, label }

    const afterChange = () => {
        records.reload();
        refreshTasks();
    };

    const save = async (record, fields, message) => {
        setBusyId(record.id);
        try {
            await updateInstructorAttendance(record.id, fields);
            toast.success(message);
            setDialog(null);
            afterChange();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyId(null);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const created = await generateInstructorAttendance();
            toast.success(created > 0 ? `Created ${created} records for this week.` : 'This week’s records already exist.');
            afterChange();
        } catch (error) {
            toast.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const actions = {
        busyId,
        approve: (record) => save(record, { status: 'completed' }, 'Marked as completed.'),
        cancel: (record) => window.confirm('Cancel this session?') && save(record, { status: 'cancelled' }, 'Session cancelled.'),
        details: (record) => {
            setDraft(record.details ?? '');
            setDialog({ type: 'details', record });
        },
        instructor: (record) => {
            setDraft(record.instructor_id);
            setDialog({ type: 'instructor', record });
        },
        viewProof: (url, label) => setProof({ url, label }),
    };

    const todayIso = today.data;
    const rows = records.data ?? [];
    const reviewRows = todayIso
        ? rows.filter((row) => row.date < todayIso && OPEN_STATUSES.includes(row.status)).sort((a, b) => a.date.localeCompare(b.date))
        : [];
    const todayRows = todayIso ? rows.filter((row) => row.date === todayIso) : [];
    const recordedClassIds = new Set(todayRows.map((row) => row.class_id));
    const missingCount = todayIso
        ? (classes.data ?? []).filter(
            (cls) => !recordedClassIds.has(cls.id) && cls.schedules.some((schedule) => schedule.day_of_week === isoWeekdayOf(todayIso))
        ).length
        : 0;

    return (
        <>
            {reviewRows.length > 0 && <ReviewQueue rows={reviewRows} actions={actions} />}
            <TodaySessions
                state={records}
                today={todayIso}
                rows={todayRows}
                missingCount={missingCount}
                actions={actions}
                onGenerate={handleGenerate}
                generating={generating}
            />
            <AttendanceList state={records} today={todayIso} actions={actions} />
            <AttendanceChart />

            <Modal isOpen={dialog?.type === 'details'} onOpenChange={(open) => !open && setDialog(null)}>
                <ModalContent>
                    <ModalHeader>Session note</ModalHeader>
                    <ModalBody>
                        <Textarea label="Note" placeholder="e.g. Substitute teacher, class ended early…" value={draft} onValueChange={setDraft} />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setDialog(null)}>Close</Button>
                        <Button color="danger" isLoading={busyId === dialog?.record.id} onPress={() => save(dialog.record, { details: draft }, 'Note saved.')}>
                            Save note
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={dialog?.type === 'instructor'} onOpenChange={(open) => !open && setDialog(null)}>
                <ModalContent>
                    <ModalHeader>Change instructor</ModalHeader>
                    <ModalBody>
                        <Select
                            label="New instructor"
                            placeholder="Select an instructor"
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
                            color="danger"
                            isLoading={busyId === dialog?.record.id}
                            isDisabled={!draft || draft === dialog?.record.instructor_id}
                            onPress={() => save(dialog.record, { instructorId: draft }, 'Instructor changed.')}
                        >
                            Change instructor
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={Boolean(proof)} onOpenChange={(open) => !open && setProof(null)} size="lg">
                <ModalContent>
                    <ModalHeader>{proof?.label}</ModalHeader>
                    <ModalBody className="pb-6">{proof && <Image src={proof.url} alt={proof.label} />}</ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
};

export default Attendance;
