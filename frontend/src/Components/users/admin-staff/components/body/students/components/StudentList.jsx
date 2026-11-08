import { useState } from 'react';
import { Select, SelectItem, Tooltip } from '@nextui-org/react';
import { LuBookOpen, LuClock, LuDoorOpen, LuGraduationCap, LuMousePointerClick, LuUsers } from 'react-icons/lu';
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
import ClassAttendanceHistory from './ClassAttendanceHistory';
import SectionCard from '../../../common/SectionCard';
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

const StudentList = ({ historyVersion }) => {
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

    const memberRows = (cls) =>
        cls.students.map(({ student, joined_at }, index) => ({
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
        }));

    const classPicker = classes.data?.length ? (
        <Select
            label="Class"
            size="sm"
            placeholder="Select a class"
            className="classPicker"
            selectedKeys={selectedId ? [selectedId] : []}
            onChange={(event) => setSelectedId(event.target.value)}
        >
            {classes.data.map((item) => (
                <SelectItem key={String(item.id)}>{item.name}</SelectItem>
            ))}
        </Select>
    ) : null;

    return (
        <SectionCard
            icon={LuGraduationCap}
            title="Class members"
            subtitle="Pick a class to see when and where it meets, and add or remove its students."
            actions={classPicker}
        >
            <AsyncState state={classes} emptyText="No classes yet. Add one on the Classes page.">
                {selected ? (
                    <div className="subPanel">
                        <div className="subPanelHeader">
                            <img src={classImageUrl(selected.image_path) ?? placeholder} alt="" />
                            <div className="subPanelMeta">
                                <h3>{selected.name}</h3>
                                <p>{selected.instructor?.full_name || selected.instructor?.username || 'No instructor'}</p>
                            </div>
                        </div>

                        <div className="infoTiles">
                            <div className="infoTile">
                                <span className="infoLabel">
                                    <LuClock aria-hidden="true" /> Schedule
                                </span>
                                {selected.schedules.length === 0 ? (
                                    <span className="infoValue isMuted">No schedule yet</span>
                                ) : (
                                    selected.schedules.map((s) => (
                                        <span className="infoValue" key={s.id}>
                                            {weekdayLabel(s.day_of_week)} <small>{formatTimeRange(s.start_time, s.end_time)}</small>
                                        </span>
                                    ))
                                )}
                            </div>
                            <div className="infoTile">
                                <span className="infoLabel">
                                    <LuDoorOpen aria-hidden="true" /> Room
                                </span>
                                <span className={`infoValue${selected.room ? '' : ' isMuted'}`}>{selected.room?.name ?? 'No room assigned'}</span>
                                {selected.room?.size && <small className="infoNote">{selected.room.size}</small>}
                            </div>
                            <div className="infoTile">
                                <span className="infoLabel">
                                    <LuBookOpen aria-hidden="true" /> Lesson
                                </span>
                                <span className={`infoValue${selected.lesson ? '' : ' isMuted'}`}>{selected.lesson || 'Not set'}</span>
                            </div>
                            <div className="infoTile">
                                <span className="infoLabel">
                                    <LuUsers aria-hidden="true" /> Members
                                </span>
                                <span className="infoValue isBig">{selected.students.length}</span>
                            </div>
                        </div>

                        <TableTemplate
                            ariaLabel={`Students of ${selected.name}`}
                            data={memberRows(selected)}
                            columns={columns}
                            initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                            StatusBtn_active="hidden"
                            onAddNew={() => setAdding(true)}
                        />
                        <ClassAttendanceHistory key={selected.id} cls={selected} version={historyVersion} />
                    </div>
                ) : (
                    <div className="pickPrompt">
                        <LuMousePointerClick aria-hidden="true" />
                        <span>Choose a class from the menu above to see its members.</span>
                    </div>
                )}
            </AsyncState>
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
        </SectionCard>
    );
};

export default StudentList;
