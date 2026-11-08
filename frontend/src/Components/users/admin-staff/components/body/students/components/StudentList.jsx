import { useState } from 'react';
import { Select, SelectItem, Tooltip } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { listClassesWithStudents, removeStudent } from '@/services/classes';
import { listGuests } from '@/services/users';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatDate, formatTimeRange, weekdayLabel } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../Table/TableTemplate';
import { DeleteIcon } from '../../../../../../Table/DeleteIcon';
import AddStudentForm from './AddStudentForm';
import placeholder from '@/assets/images/logo-mark.webp';

const INITIAL_VISIBLE_COLUMNS = ['no', 'user', 'contact', 'dob', 'joined', 'actions'];
const columns = [
    { name: 'No.', uid: 'no' },
    { name: 'Student', uid: 'user' },
    { name: 'Contact', uid: 'contact' },
    { name: 'DOB', uid: 'dob' },
    { name: 'Joined', uid: 'joined' },
    { name: 'Actions', uid: 'actions' },
];

const StudentList = () => {
    const toast = useToast();
    const classes = useAsync(listClassesWithStudents, []);
    const guests = useAsync(listGuests, []);
    const [selectedId, setSelectedId] = useState('');
    const [adding, setAdding] = useState(false);

    const selected = (classes.data ?? []).find((item) => String(item.id) === selectedId);

    const handleRemove = async (student) => {
        const name = student.full_name || student.username;
        if (!window.confirm(`Remove ${name} from ${selected.name}?`)) return;
        try {
            await removeStudent(selected.id, student.id);
            toast.success('Student removed.');
            classes.reload();
        } catch (error) {
            toast.error(error);
        }
    };

    return (
        <div>
            <div className="myClasses sectionContainer flex flex-col gap-10">
                <div className="heading uppercase text-3xl font-semibold text-center">Class’s Details</div>
                <div className="subHeading text-xl font-normal text-center">
                    <h1>View a class’s details, add or remove students</h1>
                </div>
                <AsyncState state={classes} emptyText="No classes yet. Add one in Classes & Schedules.">
                    {(list) => (
                        <div className="selectContainer flex items-center">
                            <Select
                                label="Class"
                                placeholder="Select Class"
                                selectedKeys={selectedId ? [selectedId] : []}
                                onChange={(event) => setSelectedId(event.target.value)}
                            >
                                {list.map((item) => (
                                    <SelectItem key={String(item.id)}>{item.name}</SelectItem>
                                ))}
                            </Select>
                        </div>
                    )}
                </AsyncState>

                {selected && (
                    <div className="singleItem flex">
                        <div className="classImgDiv flex">
                            <div className="img">
                                <img src={classImageUrl(selected.image_path) ?? placeholder} alt={selected.name} />
                            </div>
                            <h2>{selected.name}</h2>
                        </div>
                        <div className="classDetails cards flex">
                            <div className="heading1">
                                <h2>DETAILS</h2>
                            </div>
                            <div className="singleContent flex">
                                <div className="heading2 font-semibold">
                                    <h3>Schedule</h3>
                                </div>
                                <div className="cards font-semibold">
                                    {selected.schedules.length === 0 && <h3 className="font-normal">No schedule yet</h3>}
                                    {selected.schedules.map((s) => (
                                        <h3 key={s.id}>
                                            {weekdayLabel(s.day_of_week)}: <span className="font-normal">{formatTimeRange(s.start_time, s.end_time)}</span>
                                        </h3>
                                    ))}
                                </div>
                            </div>
                            <div className="singleContent flex">
                                <div className="heading2 font-semibold">
                                    <h3>Room</h3>
                                </div>
                                <div className="cards font-semibold">
                                    <h3>{selected.room ? `${selected.room.name}${selected.room.size ? ` – ${selected.room.size}` : ''}` : 'No room assigned'}</h3>
                                </div>
                            </div>
                            <div className="singleContent flex">
                                <div className="heading2 font-semibold">
                                    <h3>Lesson’s Detail</h3>
                                </div>
                                <div className="cards font-semibold">
                                    <h3>{selected.lesson || '—'}</h3>
                                </div>
                            </div>
                            <div className="singleContent flex">
                                <div className="heading2 font-semibold">
                                    <h3>Class’s members</h3>
                                </div>
                                <div className="studentTable cards">
                                    <TableTemplate
                                        ariaLabel={`Students of ${selected.name}`}
                                        data={selected.students.map(({ student, joined_at }, index) => ({
                                            id: student.id,
                                            no: index + 1,
                                            name: student.full_name,
                                            username: student.username,
                                            email: student.email,
                                            avatar: avatarUrl(student.avatar_path, student.updated_at),
                                            contact: student.contact_number ?? '',
                                            dob: formatDate(student.date_of_birth),
                                            joined: formatDate(joined_at),
                                            actions: (
                                                <div className="relative flex items-center justify-center gap-2">
                                                    <Tooltip color="danger" content="Remove student">
                                                        <button
                                                            type="button"
                                                            aria-label="Remove student"
                                                            className="text-lg text-danger cursor-pointer active:opacity-50"
                                                            onClick={() => handleRemove(student)}
                                                        >
                                                            <DeleteIcon />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            ),
                                        }))}
                                        columns={columns}
                                        initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                                        StatusBtn_active="hidden"
                                        onAddNew={() => setAdding(true)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {adding && selected && (
                <AddStudentForm
                    classRow={selected}
                    guests={guests.data ?? []}
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        classes.reload();
                    }}
                />
            )}
        </div>
    );
};

export default StudentList;
