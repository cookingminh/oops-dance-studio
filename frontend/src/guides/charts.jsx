import { ROLES } from '@/auth/roles';
import { SERIES, STATUS_COLORS } from '@/Components/users/admin-staff/components/common/chartTheme';
import { ExBars, ExColumns, ExControls, ExSplits, ExTable } from '@/ui/guide/GuideExamples';

// The Charts page (admin and staff): what each chart shows, with a worked example.
const ROOM_A = { name: 'Phòng A', color: SERIES[0] };
const ROOM_B = { name: 'Phòng B', color: SERIES[1] };

export default {
    id: 'admin-charts',
    build: ({ t, intl }, { role }) => {
        const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1 });
        const money = (value) => compact.format(value);
        const vnd = (value) => `${new Intl.NumberFormat(intl).format(value)} ₫`;
        const status = (key) => ({ label: t(key.charAt(0).toUpperCase() + key.slice(1)), color: STATUS_COLORS[key] });

        return {
            id: 'admin-charts',
            title: t('Charts'),
            intro: t('Three charts show how the studio is doing: what the rooms earn, how bookings go and how full each class is. They follow bookings and enrolments by themselves.'),
            sections: [
                {
                    id: 'revenue',
                    title: t('Monthly revenue'),
                    body: t('Each column is a month and each colour a room. Its height is the money actually received for room bookings: deposits and payments, minus refunds.'),
                    example: (
                        <ExColumns
                            columns={[
                                { label: t('Sep'), parts: [{ value: 4200000, color: ROOM_A.color }, { value: 3100000, color: ROOM_B.color }] },
                                { label: t('Oct'), parts: [{ value: 5600000, color: ROOM_A.color }, { value: 5100000, color: ROOM_B.color }] },
                                { label: t('Nov'), parts: [{ value: 2000000, color: ROOM_A.color }, { value: 1600000, color: ROOM_B.color }] },
                            ]}
                            legend={[
                                { label: ROOM_A.name, color: ROOM_A.color },
                                { label: ROOM_B.name, color: ROOM_B.color },
                            ]}
                            format={money}
                            highlight={t('Oct')}
                            callout={t('October: {total} in all — {a} from Phòng A and {b} from Phòng B. November is still running, so its column is shorter.', {
                                total: money(10700000),
                                a: money(5600000),
                                b: money(5100000),
                            })}
                        />
                    ),
                    tip: t('Hover over a column (or tap it) to see each room’s exact amount.'),
                },
                {
                    id: 'table',
                    title: t('Chart or table'),
                    body: t('Every chart can turn into a table: handy to read exact numbers or copy them into a spreadsheet.'),
                    example: (
                        <>
                            <ExControls items={[{ label: t('Chart') }, { label: t('Table'), on: true }]} />
                            <ExTable
                                head={[t('Month'), ROOM_A.name, ROOM_B.name]}
                                rows={[
                                    [t('Oct'), vnd(5600000), vnd(5100000)],
                                    [t('Nov'), vnd(2000000), vnd(1600000)],
                                ]}
                            />
                        </>
                    ),
                },
                {
                    id: 'bookings',
                    title: t('Booking status'),
                    body: t('Pick a month at the top of the card. Each room’s bookings are split by status: completed, approved, waiting for approval, rejected or cancelled.'),
                    example: (
                        <ExSplits
                            rows={[
                                {
                                    label: ROOM_A.name,
                                    parts: [
                                        { value: 15, color: STATUS_COLORS.completed },
                                        { value: 4, color: STATUS_COLORS.approved },
                                        { value: 2, color: STATUS_COLORS.pending },
                                        { value: 1, color: STATUS_COLORS.cancelled },
                                    ],
                                },
                                {
                                    label: ROOM_B.name,
                                    parts: [
                                        { value: 18, color: STATUS_COLORS.completed },
                                        { value: 5, color: STATUS_COLORS.approved },
                                        { value: 2, color: STATUS_COLORS.cancelled },
                                    ],
                                },
                            ]}
                            legend={['completed', 'approved', 'pending', 'cancelled'].map(status)}
                            callout={t('Phòng B: 2 of its 25 bookings were cancelled (8%). Plenty of yellow means requests are waiting for you on the Bookings page.')}
                        />
                    ),
                },
                {
                    id: 'classes',
                    title: t('Class enrolment'),
                    body: t('How many students each class has right now. A short bar is a class that needs more students.'),
                    example: (
                        <ExBars
                            rows={[
                                { label: 'Choreo CG', value: 8 },
                                { label: 'Trending', value: 7 },
                                { label: 'K-pop Dance', value: 6 },
                                { label: 'Girlstyle 1', value: 2, tone: 'low' },
                            ]}
                            callout={t('{cls} has {count} students: a good class to promote, or to offer a free first class in.', { cls: 'Girlstyle 1', count: 2 })}
                        />
                    ),
                },
            ],
            outro:
                role === ROLES.admin
                    ? t('For the whole picture — tuition, salaries, expenses and profit — open Reports. Press (?) at the top any time to see this again.')
                    : t('Press (?) at the top any time to see this again.'),
        };
    },
};
