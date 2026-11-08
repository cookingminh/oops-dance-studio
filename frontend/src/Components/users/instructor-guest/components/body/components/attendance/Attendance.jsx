import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { listMyInstructorAttendance } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { classImageUrl } from '@/services/storage';
import { formatDateTime, formatTimeRange, isoWeekdayOf } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../Table/TableTemplate';
import CheckForm from './CheckForm';
import './attendance.scss';
import placeholder from '@/assets/images/logo-mark.webp';

const columns = [
    { name: 'Date', uid: 'date', allowsSorting: true },
    { name: 'Class Name', uid: 'class_name', allowsSorting: true },
    { name: 'Room', uid: 'room' },
    { name: 'Check-in', uid: 'checkin_time' },
    { name: 'Check-in Proof', uid: 'checkin_proof' },
    { name: 'Check-out', uid: 'checkout_time' },
    { name: 'Check-out Proof', uid: 'checkout_proof' },
    { name: 'Status', uid: 'status', allowsSorting: true },
    { name: 'Details', uid: 'details' },
];

const statusOptions = ['pending', 'waiting', 'in_progress', 'completed', 'cancelled'].map((uid) => ({ uid, name: uid.replace('_', ' ') }));

async function loadToday(instructorId) {
    const today = await getStudioToday();
    const rows = await listMyInstructorAttendance(instructorId, { date: today });
    const weekday = isoWeekdayOf(today);
    return rows.map((row) => ({ ...row, todaysSchedule: row.class?.schedules?.find((s) => s.day_of_week === weekday) }));
}

const ACTION_BY_STATUS = { pending: 'checkin', waiting: 'checkin', in_progress: 'checkout' };

const Attendance = () => {
    const { user } = useAuth();
    const today = useAsync(() => loadToday(user.id), [user.id]);
    const history = useAsync(() => listMyInstructorAttendance(user.id, { withProofs: true }), [user.id]);
    const [checking, setChecking] = useState(null); // { kind, attendance }

    const rows = (history.data ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        class_name: row.class?.name,
        room: row.room?.name ?? '',
        checkin_time: formatDateTime(row.checkin_at),
        checkout_time: formatDateTime(row.checkout_at),
        checkin_proof: row.checkin_proof_url,
        checkout_proof: row.checkout_proof_url,
        status: row.status,
        details: row.details ?? '',
    }));

    return (
        <div className="attendance">
            <div className="todayClassesDiv sectionContainer flex">
                <div className="heading">
                    <h1>Classes Today</h1>
                </div>

                <div className="singleItem flex cards">
                    <div className="heading1">
                        <h1>Your Classes Today</h1>
                    </div>
                    <div className="cards todaySchedule flex">
                        <div className="schedule">
                            <AsyncState state={today} emptyText="No class for today.">
                                {(list) =>
                                    list.map((row) => {
                                        const action = ACTION_BY_STATUS[row.status];
                                        return (
                                            <div key={row.id} className="singleCard flex">
                                                <Link to="/profile/my-classes" className="classImg">
                                                    <img src={classImageUrl(row.class?.image_path) ?? placeholder} alt={row.class?.name} />
                                                </Link>
                                                <div className="cardText">
                                                    <span>
                                                        {row.class?.name} <br />
                                                        {row.todaysSchedule && formatTimeRange(row.todaysSchedule.start_time, row.todaysSchedule.end_time)}
                                                    </span>
                                                </div>
                                                {action ? (
                                                    <button type="button" className="btn" onClick={() => setChecking({ kind: action, attendance: row })}>
                                                        {action === 'checkin' ? 'Check In Now' : 'Check Out Now'}
                                                    </button>
                                                ) : (
                                                    <button type="button" className="btn capitalize" disabled>{row.status}</button>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </AsyncState>
                        </div>
                    </div>
                </div>

                <div className="reportDiv cards flex">
                    <h2>Anything wrong? Send a report</h2>
                    <a className="btn" href="mailto:oopsdancestudio@gmail.com?subject=Attendance%20report">Make a report</a>
                </div>
            </div>

            <div className="historyDiv sectionContainer">
                <div className="header">
                    <h2>Your Attendance Records</h2>
                </div>
                <div className="tableDiv">
                    <AsyncState state={history} isEmpty={false}>
                        <TableTemplate
                            ariaLabel="My attendance records"
                            columns={columns}
                            data={rows}
                            statusOptions={statusOptions}
                            initialVisibleColumns={columns.map((col) => col.uid)}
                        />
                    </AsyncState>
                </div>
            </div>

            {checking && (
                <CheckForm
                    kind={checking.kind}
                    attendance={checking.attendance}
                    instructorName={user.full_name || user.username}
                    onClose={() => setChecking(null)}
                    onDone={() => {
                        setChecking(null);
                        today.reload();
                        history.reload();
                    }}
                />
            )}
        </div>
    );
};

export default Attendance;
