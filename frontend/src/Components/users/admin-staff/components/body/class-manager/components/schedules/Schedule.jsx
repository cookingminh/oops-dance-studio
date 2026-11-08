import { useState } from 'react';
import { Tooltip } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { deleteSchedule, listSchedules } from '@/services/schedules';
import { formatTime, weekdayLabel } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../../Table/TableTemplate';
import { DeleteIcon } from '../../../../../../../Table/DeleteIcon';
import { EditIcon } from '../../../../../../../Table/EditIcon';
import ScheduleForm from './ScheduleForm';

const columns = [
    { name: 'Class', uid: 'class_name', allowsSorting: true },
    { name: 'Day of the Week', uid: 'day_label', allowsSorting: true },
    { name: 'Start Time', uid: 'start_time', allowsSorting: true },
    { name: 'End Time', uid: 'end_time', allowsSorting: true },
    { name: 'Action', uid: 'actions' },
];

// `classes` is the useAsync state of the class list (for the class picker).
const Schedule = ({ classes, refreshKey, onChanged }) => {
    const toast = useToast();
    const schedules = useAsync(listSchedules, [refreshKey]);
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete ${row.class?.name}'s ${weekdayLabel(row.day_of_week)} ${formatTime(row.start_time)} session?`)) return;
        try {
            await deleteSchedule(row.id);
            toast.success('Schedule deleted.');
            schedules.reload();
            onChanged();
        } catch (error) {
            toast.error(error);
        }
    };

    const rows = (schedules.data ?? []).map((item) => ({
        id: item.id,
        class_name: item.class?.name ?? '',
        // Sort key keeps Monday…Sunday order; the label is what users see.
        day_label: `${item.day_of_week} · ${weekdayLabel(item.day_of_week)}`,
        start_time: formatTime(item.start_time),
        end_time: formatTime(item.end_time),
        actions: (
            <div className="relative flex items-center justify-center gap-2">
                <Tooltip content="Edit schedule">
                    <button type="button" aria-label="Edit schedule" className="text-lg text-default-400 cursor-pointer active:opacity-50" onClick={() => setEditing(item)}>
                        <EditIcon />
                    </button>
                </Tooltip>
                <Tooltip color="danger" content="Delete schedule">
                    <button type="button" aria-label="Delete schedule" className="text-lg text-danger cursor-pointer active:opacity-50" onClick={() => handleDelete(item)}>
                        <DeleteIcon />
                    </button>
                </Tooltip>
            </div>
        ),
    }));

    return (
        <div className="classScheduleDiv sectionContainer">
            <h2>Schedule</h2>
            <AsyncState state={schedules} isEmpty={false}>
                <TableTemplate
                    ariaLabel="Class schedules"
                    columns={columns}
                    data={rows}
                    initialVisibleColumns={columns.map((col) => col.uid)}
                    onAddNew={() => setEditing(null)}
                />
            </AsyncState>
            {editing !== undefined && (
                <ScheduleForm
                    schedule={editing}
                    classes={classes.data ?? []}
                    onClose={() => setEditing(undefined)}
                    onSaved={() => {
                        setEditing(undefined);
                        schedules.reload();
                        onChanged();
                    }}
                />
            )}
        </div>
    );
};

export default Schedule;
