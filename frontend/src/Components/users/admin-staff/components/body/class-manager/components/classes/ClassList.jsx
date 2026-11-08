import { useState } from 'react';
import { Button, DropdownTrigger, Dropdown, DropdownMenu, DropdownItem } from '@nextui-org/react';
import { deleteClass } from '@/services/classes';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatTimeRange, formatVnd, weekdayLabel } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { VerticalDotsIcon } from '../../../../../../../Table/VerticalDotsIcon';
import TableTemplate from '../../../../../../../Table/TableTemplate';
import ClassForm from './ClassForm';
import ChangeClassImageForm from './ChangeClassImageForm';

const INITIAL_VISIBLE_COLUMNS = ['class_name', 'class_lesson', 'room', 'instructor', 'schedule', 'price', 'actions'];

const columns = [
    { name: 'Class ID', uid: 'id', allowsSorting: true },
    { name: 'Class name', uid: 'class_name', allowsSorting: true },
    { name: 'Lesson', uid: 'class_lesson' },
    { name: 'Room', uid: 'room', allowsSorting: true },
    { name: 'Instructor', uid: 'instructor', allowsSorting: true },
    { name: 'Schedule', uid: 'schedule' },
    { name: 'Price', uid: 'price' },
    { name: 'Actions', uid: 'actions' },
];

// `classes`, `instructors`, `rooms` are useAsync states owned by ClassManager (shared with Schedule).
const ClassList = ({ classes, instructors, rooms, onChanged }) => {
    const toast = useToast();
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
    const [changingImage, setChangingImage] = useState(null);

    const rows = (classes.data ?? []).map((record) => ({
        id: record.id,
        record,
        class_name: record.name,
        class_img: classImageUrl(record.image_path),
        class_lesson: record.lesson ?? '',
        instructor_name: record.instructor?.full_name || record.instructor?.username,
        instructor_email: record.instructor?.email,
        instructor_avatar: avatarUrl(record.instructor?.avatar_path, record.instructor?.updated_at),
        instructor: record.instructor?.full_name || record.instructor?.username,
        room: record.room?.name ?? '—',
        schedule: record.schedules.length
            ? [...record.schedules]
                .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                .map((s) => <div key={s.id}>{`${weekdayLabel(s.day_of_week)} ${formatTimeRange(s.start_time, s.end_time)}`}</div>)
            : <span className="text-default-400">No schedule yet</span>,
        price: formatVnd(record.price),
    }));

    const handleDelete = async (record) => {
        if (!window.confirm(`Delete “${record.name}”? Its schedules, enrolments and attendance records are deleted too.`)) return;
        try {
            await deleteClass(record);
            toast.success('Class deleted.');
            onChanged();
        } catch (error) {
            toast.error(error);
        }
    };

    const renderActions = (item) => (
        <Dropdown>
            <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light" aria-label={`Actions for ${item.class_name}`}>
                    <VerticalDotsIcon className="text-default-300" />
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Class actions">
                <DropdownItem key="edit" onPress={() => setEditing(item.record)}>Edit class information</DropdownItem>
                <DropdownItem key="image" onPress={() => setChangingImage(item.record)}>Change class image</DropdownItem>
                <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => handleDelete(item.record)}>
                    Delete class
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );

    return (
        <div className="classListDiv sectionContainer">
            <div className="header">
                <h2>Classes</h2>
            </div>
            <AsyncState state={classes} isEmpty={false}>
                <TableTemplate
                    ariaLabel="Classes"
                    columns={columns}
                    data={rows}
                    initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                    renderActions={renderActions}
                    onAddNew={() => setEditing(null)}
                />
            </AsyncState>
            {editing !== undefined && (
                <ClassForm
                    classRow={editing}
                    instructors={instructors.data ?? []}
                    rooms={rooms.data ?? []}
                    onClose={() => setEditing(undefined)}
                    onSaved={() => {
                        setEditing(undefined);
                        onChanged();
                    }}
                />
            )}
            {changingImage && (
                <ChangeClassImageForm
                    classRow={changingImage}
                    onClose={() => setChangingImage(null)}
                    onSaved={() => {
                        setChangingImage(null);
                        onChanged();
                    }}
                />
            )}
        </div>
    );
};

export default ClassList;
