import { useState } from 'react';
import { Button, Chip, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, User } from '@nextui-org/react';
import { LuDownload, LuPanelRightOpen } from 'react-icons/lu';
import { addDays, parseISO, startOfWeek } from 'date-fns';
import { avatarUrl } from '@/services/storage';
import { formatClock, toIsoDate } from '@/lib/format';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import { statusColorMap } from '../../../../../../Table/utils';
import Segmented from '../../../common/Segmented';
import MakeUpTag from '../../class-manager/routines/MakeUpTag';
import LateTag from '../../../common/checkins/LateTag';
import { personName, teacherOf } from '../../../common/session-modal/sessionModel';
import { NoteButton } from './AttendanceParts';
import { downloadCsv } from './csv';

const PAGE_SIZE = 10;
// Labels are English (translated where shown).
const SCOPES = [
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'all', label: 'All dates' },
];
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

// The list view of "All sessions": every recorded session (newest first) as a table, for searching
// across dates and for a CSV export. `sessions` come filtered; the period is picked here.
const AttendanceList = ({ state, sessions, today, onOpen }) => {
    const { t, tn, formatDate } = useI18n();
    const [scope, setScope] = useState('month');
    const [page, setPage] = useState(1);

    const visible = sessions.filter((session) => inScope(session.date, scope, today));
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const statusText = (row) => t(row.status === 'in_progress' ? 'in progress' : row.status);

    const exportCsv = () =>
        downloadCsv(
            `sessions-${scope === 'all' ? 'all' : today}.csv`,
            [t('Date'), t('Start'), t('End'), t('Class'), t('Room'), t('Instructor'), t('Check-in'), t('Check-out'), t('Late check-out'), t('Status'), t('Make-up'), t('Note')],
            visible.map(({ date, start, end, cls, row, extra }) => [
                date,
                start,
                end,
                cls.name,
                cls.room?.name ?? '',
                personName(row.instructor),
                row.checkin_at ? formatClock(row.checkin_at) : '',
                row.checkout_at ? formatClock(row.checkout_at) : '',
                row.checkout_late ? t('Yes') : '',
                statusText(row),
                extra ? t('Yes') : '',
                row.details ?? '',
            ])
        );

    const renderCell = (session, key) => {
        const { row, cls } = session;
        switch (key) {
            case 'date':
                return (
                    <div className="stackCell">
                        <strong>
                            {formatDate(session.date, 'short')}
                            {session.date === today && <span className="todayTag">{t('Today')}</span>}
                        </strong>
                        <span>
                            {session.start && `${session.start} – ${session.end}`}
                            {session.extra && <MakeUpTag className="sessionTag" />}
                        </span>
                    </div>
                );
            case 'instructor': {
                const teacher = teacherOf(session);
                const name = personName(teacher) || t('Instructor');
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, size: 'sm', src: avatarUrl(teacher?.avatar_path, teacher?.updated_at) ?? undefined, name }}
                        name={name}
                        description={teacher?.email}
                    />
                );
            }
            case 'class':
                return (
                    <div className="stackCell">
                        <strong>{cls.name}</strong>
                        <span>{cls.room?.name}</span>
                    </div>
                );
            case 'checkin':
            case 'checkout': {
                const at = key === 'checkin' ? row.checkin_at : row.checkout_at;
                return (
                    <span className={`atListTime${at ? '' : ' isMuted'}`}>
                        {at ? formatClock(at) : '—'}
                        {key === 'checkout' && row.checkout_late && <LateTag />}
                    </span>
                );
            }
            case 'status':
                return (
                    <Chip className="capitalize" color={statusColorMap[row.status] ?? 'default'} size="sm" variant="flat">
                        {statusText(row)}
                    </Chip>
                );
            case 'actions':
                return (
                    <div className="rowActions">
                        {row.details ? <NoteButton record={row} /> : <span className="actionSlot" aria-hidden="true" />}
                        <Button isIconOnly size="sm" variant="light" aria-label={t('Open the session: {name}, {time}', { name: cls.name, time: formatDate(session.date, 'short') })} onPress={() => onOpen(session)}>
                            <LuPanelRightOpen className="text-default-500" aria-hidden="true" />
                        </Button>
                    </div>
                );
            default:
                return null;
        }
    };

    const from = visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(currentPage * PAGE_SIZE, visible.length);

    return (
        <div className="atList">
            <div className="atListBar">
                <Segmented
                    label={t('Period')}
                    options={SCOPES.map((option) => ({ ...option, label: t(option.label) }))}
                    value={scope}
                    onChange={(value) => {
                        setScope(value);
                        setPage(1);
                    }}
                />
                <span className="atListCount">{tn(visible.length, '{count} session', '{count} sessions')}</span>
                <Button size="sm" variant="flat" startContent={<LuDownload aria-hidden="true" />} isDisabled={visible.length === 0} onPress={exportCsv}>
                    {t('Export CSV')}
                </Button>
            </div>
            <AsyncState state={state} isEmpty={false}>
                <div className="tableScroll">
                    <Table aria-label={t('Instructor attendance')} removeWrapper className="bookingTable">
                        <TableHeader columns={COLUMNS}>
                            {(column) => (
                                <TableColumn key={column.key} align={column.key === 'actions' ? 'end' : 'start'}>
                                    {t(column.label)}
                                </TableColumn>
                            )}
                        </TableHeader>
                        <TableBody items={pageRows} emptyContent={<div className="tableEmpty">{t('No sessions match these filters.')}</div>}>
                            {(session) => <TableRow key={session.key}>{(key) => <TableCell>{renderCell(session, key)}</TableCell>}</TableRow>}
                        </TableBody>
                    </Table>
                </div>
                {visible.length > 0 && (
                    <div className="tableFooter">
                        <span>{t('{from}–{to} of {total}', { from, to, total: visible.length })}</span>
                        {pages > 1 && <Pagination isCompact showControls color="danger" page={currentPage} total={pages} onChange={setPage} />}
                    </div>
                )}
            </AsyncState>
        </div>
    );
};

export default AttendanceList;
