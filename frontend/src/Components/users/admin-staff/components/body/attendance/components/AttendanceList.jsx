import { useState } from 'react';
import { Input, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, User } from '@nextui-org/react';
import { LuClipboardCheck, LuSearch } from 'react-icons/lu';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { INSTRUCTOR_ATTENDANCE_STATUSES } from '@/services/attendance';
import { avatarUrl } from '@/services/storage';
import { formatClock, toIsoDate } from '@/lib/format';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { statusColorMap } from '../../../../../../Table/utils';
import SectionCard from '../../../common/SectionCard';
import Segmented from '../../../common/Segmented';
import StatusSelect from '../../../common/StatusSelect';
import { STATUS_COLORS } from '../../../common/chartTheme';
import { sessionTimes } from '../../../../tasks/staffTasks';
import { AttendanceMenu, NoteButton, ProofThumb } from './AttendanceParts';

const PAGE_SIZE = 10;
const SCOPES = [
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'all', label: 'All dates' },
];
const STATUS_LABEL = (status) => (status === 'in_progress' ? 'In progress' : status[0].toUpperCase() + status.slice(1));
const STATUS_DOT = { ...STATUS_COLORS, in_progress: '#2a78d6', waiting: '#eda100' };
const COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'instructor', label: 'Instructor' },
    { key: 'class', label: 'Class' },
    { key: 'checkin', label: 'Check-in' },
    { key: 'checkout', label: 'Check-out' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
];

function inScope(date, scope, today) {
    if (scope === 'all' || !today) return true;
    if (scope === 'month') return date.slice(0, 7) === today.slice(0, 7);
    const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
    return date >= toIsoDate(monday) && date <= toIsoDate(addDays(monday, 6));
}

// Every instructor session, newest first, filtered by period, instructor and status.
const AttendanceList = ({ state, today, actions }) => {
    const [scope, setScope] = useState('week');
    const [statusFilter, setStatusFilter] = useState('all');
    const [instructorId, setInstructorId] = useState('all');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filterSetter = (setter) => (value) => {
        setter(value);
        setPage(1);
    };

    const rows = state.data ?? [];
    const instructors = [...new Map(rows.map((row) => [row.instructor_id, row.instructor])).entries()]
        .map(([id, person]) => ({ id, name: person?.full_name || person?.username || 'Instructor' }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const term = query.trim().toLowerCase();
    const base = rows.filter((row) => {
        if (!inScope(row.date, scope, today)) return false;
        if (instructorId !== 'all' && row.instructor_id !== instructorId) return false;
        if (!term) return true;
        return [row.date, row.instructor?.full_name, row.instructor?.username, row.instructor?.email, row.class?.name, row.room?.name, row.details]
            .some((value) => String(value ?? '').toLowerCase().includes(term));
    });
    const statusCounts = new Map();
    for (const row of base) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    const visible = base
        .filter((row) => statusFilter === 'all' || row.status === statusFilter)
        .sort((a, b) => b.date.localeCompare(a.date) || sessionTimes(b.class, b.date).start.localeCompare(sessionTimes(a.class, a.date).start));

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const statusOptions = [
        { key: 'all', label: 'Any status', count: base.length },
        ...INSTRUCTOR_ATTENDANCE_STATUSES.filter((status) => statusCounts.get(status) || status === statusFilter).map((status) => ({
            key: status,
            label: STATUS_LABEL(status),
            count: statusCounts.get(status) ?? 0,
            color: STATUS_DOT[status],
        })),
    ];

    const renderCell = (row, key) => {
        switch (key) {
            case 'date': {
                const { start, end } = sessionTimes(row.class, row.date);
                return (
                    <div className="stackCell">
                        <strong>
                            {format(parseISO(row.date), 'EEE d MMM')}
                            {row.date === today && <span className="todayTag">Today</span>}
                        </strong>
                        <span>{start && `${start} – ${end}`}</span>
                    </div>
                );
            }
            case 'instructor': {
                const name = row.instructor?.full_name || row.instructor?.username || 'Instructor';
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, size: 'sm', src: avatarUrl(row.instructor?.avatar_path, row.instructor?.updated_at) ?? undefined, name }}
                        name={name}
                        description={row.instructor?.email}
                    />
                );
            }
            case 'class':
                return (
                    <div className="stackCell">
                        <strong>{row.class?.name}</strong>
                        <span>{row.room?.name}</span>
                    </div>
                );
            case 'checkin':
            case 'checkout': {
                const at = key === 'checkin' ? row.checkin_at : row.checkout_at;
                const proof = key === 'checkin' ? row.checkin_proof_url : row.checkout_proof_url;
                return (
                    <div className="proofCell">
                        <ProofThumb url={proof} label={key === 'checkin' ? 'Check-in proof' : 'Check-out proof'} onView={actions.viewProof} />
                        <span className={at ? undefined : 'isMuted'}>{at ? formatClock(at) : '—'}</span>
                    </div>
                );
            }
            case 'status':
                return (
                    <Chip className="capitalize" color={statusColorMap[row.status] ?? 'default'} size="sm" variant="flat">
                        {row.status.replace('_', ' ')}
                    </Chip>
                );
            case 'actions':
                return (
                    <div className="rowActions">
                        {row.details ? <NoteButton record={row} /> : <span className="actionSlot" aria-hidden="true" />}
                        <AttendanceMenu record={row} actions={actions} />
                    </div>
                );
            default:
                return null;
        }
    };

    const from = visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(currentPage * PAGE_SIZE, visible.length);

    return (
        <SectionCard
            className="bookingsCard"
            icon={LuClipboardCheck}
            title="All sessions"
            subtitle={state.data ? `${visible.length} session${visible.length === 1 ? '' : 's'} · check-in and check-out with proof photos` : 'Loading sessions…'}
            actions={
                <Input
                    isClearable
                    aria-label="Search sessions"
                    placeholder="Search..."
                    className="bookingSearch"
                    startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                    value={query}
                    onValueChange={filterSetter(setQuery)}
                    onClear={() => filterSetter(setQuery)('')}
                />
            }
        >
            <div className="bookingToolbar">
                <Select
                    aria-label="Instructor"
                    className="instructorPicker"
                    classNames={{ trigger: 'statusSelectTrigger', popoverContent: 'adminPortal' }}
                    selectedKeys={[instructorId]}
                    disallowEmptySelection
                    onChange={(event) => filterSetter(setInstructorId)(event.target.value || 'all')}
                    items={[{ id: 'all', name: 'All instructors' }, ...instructors]}
                >
                    {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                </Select>
                <div className="toolbarGroup">
                    <StatusSelect options={statusOptions} value={statusFilter} onChange={filterSetter(setStatusFilter)} />
                    <Segmented label="Period" options={SCOPES} value={scope} onChange={filterSetter(setScope)} />
                </div>
            </div>

            <AsyncState state={state} isEmpty={false}>
                <div className="tableScroll">
                    <Table aria-label="Instructor attendance" removeWrapper className="bookingTable">
                        <TableHeader columns={COLUMNS}>
                            {(column) => (
                                <TableColumn key={column.key} align={column.key === 'actions' ? 'end' : 'start'}>
                                    {column.label}
                                </TableColumn>
                            )}
                        </TableHeader>
                        <TableBody items={pageRows} emptyContent={<div className="tableEmpty">No sessions match these filters.</div>}>
                            {(row) => <TableRow key={row.id}>{(key) => <TableCell>{renderCell(row, key)}</TableCell>}</TableRow>}
                        </TableBody>
                    </Table>
                </div>
                {visible.length > 0 && (
                    <div className="tableFooter">
                        <span>
                            {from}–{to} of {visible.length}
                        </span>
                        {pages > 1 && <Pagination isCompact showControls color="danger" page={currentPage} total={pages} onChange={setPage} />}
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default AttendanceList;
