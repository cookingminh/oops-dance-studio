import { useState } from 'react';
import { Tooltip, Button } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { generateStudentAttendance, listStudentAttendance, setStudentAttendanceStatus } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatDate } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../Table/TableTemplate';
import { CheckIcon } from '../../../../../../Table/CheckIcon';
import { CrossIcon } from '../../../../../../Table/CrossIcon';
import placeholder from '@/assets/images/logo-mark.webp';

const INITIAL_VISIBLE_COLUMNS = ['no', 'user', 'contact', 'status', 'actions'];
const columns = [
    { name: 'No.', uid: 'no' },
    { name: 'Student', uid: 'user' },
    { name: 'Contact', uid: 'contact' },
    { name: 'DOB', uid: 'dob' },
    { name: 'Status', uid: 'status' },
    { name: 'Actions', uid: 'actions' },
];
const statusOptions = [
    { uid: 'pending', name: 'pending' },
    { uid: 'absent', name: 'absent' },
    { uid: 'attend', name: 'attend' },
];

async function loadToday() {
    const date = await getStudioToday();
    const rows = await listStudentAttendance({ date });
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.class_id)) groups.set(row.class_id, { cls: row.class, rows: [] });
        groups.get(row.class_id).rows.push(row);
    }
    return { date, groups: [...groups.values()] };
}

const StudentAttendance = () => {
    const toast = useToast();
    const today = useAsync(loadToday, []);
    const [generating, setGenerating] = useState(false);

    const handleStatus = async (row, status) => {
        try {
            await setStudentAttendanceStatus(row.id, status);
            today.reload();
        } catch (error) {
            toast.error(error);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const created = await generateStudentAttendance();
            toast.success(created > 0 ? `Created ${created} attendance records for today.` : 'Today’s records already exist.');
            today.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="studentAttendance sectionContainer flex flex-col gap-10">
            <div className="heading uppercase text-3xl font-semibold text-center">
                Student Attendance Today {today.data && `(${formatDate(today.data.date)})`}
            </div>
            <div className="button text-center">
                <Button onPress={handleGenerate} isLoading={generating}>Create today’s records</Button>
            </div>
            <AsyncState
                state={today}
                isEmpty={today.data?.groups.length === 0}
                emptyText="No attendance records for today. Classes scheduled today get records when you create them."
            >
                {({ groups }) => (
                    <div className="myClasses flex flex-col gap-10">
                        {groups.map(({ cls, rows }) => (
                            <div key={cls.id} className="singleItem sectionContainer flex gap-3">
                                <div className="classImgDiv flex">
                                    <div className="img">
                                        <img src={classImageUrl(cls.image_path) ?? placeholder} alt={cls.name} />
                                    </div>
                                    <h2>{cls.name}</h2>
                                </div>
                                <div className="classDetails cards">
                                    <div className="heading1">
                                        <h2>Student Attendance</h2>
                                    </div>
                                    <TableTemplate
                                        ariaLabel={`Attendance for ${cls.name}`}
                                        data={rows.map((row, index) => ({
                                            id: row.id,
                                            no: index + 1,
                                            name: row.student?.full_name,
                                            username: row.student?.username,
                                            email: row.student?.email,
                                            avatar: avatarUrl(row.student?.avatar_path, row.student?.updated_at),
                                            contact: row.student?.contact_number ?? '',
                                            dob: formatDate(row.student?.date_of_birth),
                                            status: row.status,
                                            actions: (
                                                <div className="relative flex items-center justify-center gap-2">
                                                    <Tooltip color="danger" content="Absent">
                                                        <button type="button" aria-label="Mark absent" className="text-lg text-danger cursor-pointer active:opacity-50" onClick={() => handleStatus(row, 'absent')}>
                                                            <CrossIcon />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip color="success" content="Attend">
                                                        <button type="button" aria-label="Mark attended" className="text-lg text-green-500 cursor-pointer active:opacity-50" onClick={() => handleStatus(row, 'attend')}>
                                                            <CheckIcon />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            ),
                                        }))}
                                        columns={columns}
                                        initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                                        statusOptions={statusOptions}
                                        AddNewBtn_active="hidden"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </AsyncState>
        </div>
    );
};

export default StudentAttendance;
