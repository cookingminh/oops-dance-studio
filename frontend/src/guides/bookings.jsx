import { LuHourglass, LuUndo2, LuWallet } from 'react-icons/lu';
import { ROLES } from '@/auth/roles';
import { formatVnd } from '@/lib/format';
import { SERIES } from '@/Components/users/admin-staff/components/common/chartTheme';
import { ExBlock, ExChip, ExFields, ExKey, ExZones } from '@/ui/guide/GuideExamples';

// The Bookings page (admin and staff): reading the calendar, booking for a guest, what needs doing,
// payments, cancelling with a refund, and Rooms & prices. Rooms take the calendar's colours (A blue, B orange).
const ROOM_A = SERIES[0];
const ROOM_B = SERIES[1];

// Tomorrow as 'yyyy-MM-dd', for the sample "next booking".
const tomorrow = () => {
    const date = new Date(Date.now() + 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default {
    id: 'admin-bookings',
    build: ({ t, tn, formatDate }, { role }) => {
        const hours = (count) => tn(count, '{count} hour', '{count} hours');
        const perHour = t('{rate} per hour × {hours}', { rate: formatVnd(180000), hours: hours(2) });

        return {
            id: 'admin-bookings',
            title: t('Bookings'),
            intro: t('Every room booking in one place: approve requests, take payments, cancel with the right refund and set room prices. Switch between Calendar, List and Rooms & prices at the top.'),
            sections: [
                {
                    id: 'calendar',
                    title: t('Reading the calendar'),
                    body: t('Each block is one booking, in its room’s colour. With All rooms picked, every day splits into one column per room (A, B). Click a block to open the booking.'),
                    example: (
                        <ExKey
                            rows={[
                                {
                                    sample: <ExBlock color={ROOM_A} tone="class" time="18:00" title="Trending" />,
                                    text: t('Striped: a class. The room is taken, so it can’t be booked then.'),
                                },
                                {
                                    sample: <ExBlock color={ROOM_B} tone="dashed" glow time="14:00" title="Vũ Đức Anh" badge={t('Awaiting approval')} badgeTone="pending" />,
                                    text: t('Dashed: a request from the website, waiting for you to approve it.'),
                                },
                                {
                                    sample: <ExBlock color={ROOM_A} glow time="20:30" title="Trịnh Ngọc Hân" />,
                                    text: t('Glowing red border: not fully paid yet.'),
                                },
                                {
                                    sample: <ExBlock color={ROOM_B} time="13:00" title="Nguyễn Thảo Vy" badge={t('Paid up')} badgeTone="paid" />,
                                    text: t('Paid in full ahead: it counts as completed and keeps the room.'),
                                },
                                {
                                    sample: <ExBlock color={ROOM_A} tone="muted" time="16:00" title="Mai Thanh Hà" />,
                                    text: t('Grey: already over, cancelled or rejected.'),
                                },
                            ]}
                        />
                    ),
                    tip: t('Prefer a table? Pick List at the top: search by guest name, email or booking number, and switch between upcoming and past.'),
                },
                {
                    id: 'new',
                    title: t('Booking a room for a guest'),
                    body: t('Press New booking, or click a free time on the calendar — press and drag to take several hours at once. The room, day and time fill in for you, and so does the price: the room’s hourly price × the hours, with a 50% deposit to pay first.'),
                    example: (
                        <ExFields
                            title={t('Dragged from 18:00 to 20:00 in column B')}
                            rows={[
                                { label: t('Room'), value: 'Phòng B' },
                                { label: t('Time'), value: `18:00 – 20:00 · ${hours(2)}` },
                                { label: t('Room hire'), sub: perHour, value: formatVnd(360000) },
                                { label: t('Deposit'), sub: '50%', value: formatVnd(180000), tone: 'strong' },
                            ]}
                            callout={t('Once saved, the booking opens on its QR code: the guest scans it to pay the deposit.')}
                        />
                    ),
                    tip: t('A room can’t be booked over a class or another booking, or outside 08:00–22:00. Times go in half hours.'),
                },
                {
                    id: 'todo',
                    title: t('What needs you'),
                    body: t('Next to the room tabs, these buttons count what is waiting. Press one to see only those bookings; press it again to see them all.'),
                    example: (
                        <ExKey
                            rows={[
                                {
                                    sample: <ExChip icon={LuHourglass} label={t('Awaiting approval')} count={4} />,
                                    text: t('Requests from the website. Open one and press Approve or Reject — rejecting gives back everything paid.'),
                                },
                                {
                                    sample: <ExChip icon={LuWallet} label={t('Owes money')} count={2} />,
                                    text: t('Bookings that already happened but haven’t been paid in full.'),
                                },
                                {
                                    sample: <ExChip icon={LuUndo2} label={t('To refund')} count={1} />,
                                    text: t('Cancelled bookings with money to give back. Record the refund once you’ve sent it.'),
                                },
                            ]}
                        />
                    ),
                    tip: t('Owes money and To refund only show up when there is something to do.'),
                },
                {
                    id: 'pay',
                    title: t('Taking payment'),
                    body: t('Open a booking to see its payment on the right: what is still to pay, and the deposit to pay first. Show the QR code so the guest can pay by bank transfer, or press Record payment for cash.'),
                    example: (
                        <ExFields
                            title={`${t('Booking #{id}', { id: 226 })} · Phòng B`}
                            rows={[
                                { label: t('Room hire'), sub: perHour, value: formatVnd(360000) },
                                { label: t('Received'), sub: t('the deposit, by bank transfer'), value: formatVnd(180000), tone: 'good' },
                                { label: t('Still to pay'), value: formatVnd(180000), tone: 'due' },
                            ]}
                            callout={t('A transfer whose content holds the booking’s code (like OOPSBK7SDU) is recorded by itself. Once an approved booking is paid in full, it turns Completed.')}
                        />
                    ),
                    tip: t('Agreed another price with the guest? Press Change price and give the reason.'),
                },
                {
                    id: 'cancel',
                    title: t('Cancelling and refunds'),
                    body: t('Cancel from the booking’s dialog. The app asks who asked to cancel and works out the refund from the cancellation policy; you can change the amount if you give a reason.'),
                    example: (
                        <ExZones
                            marker={{ at: 0.48, label: t('Guest cancels') }}
                            zones={[
                                { label: t('50% back'), size: 3, tone: 'part' },
                                { label: t('Nothing back'), size: 2, tone: 'none' },
                            ]}
                            ticks={[
                                { at: 0, label: t('Booked') },
                                { at: 0.6, label: t('24 h before') },
                                { at: 1, label: t('Booking starts') },
                            ]}
                            callout={t('With 50% back until 24 hours before: a guest who paid a {deposit} deposit and cancels two days ahead gets {back} back, and the studio keeps {kept}. If the studio cancels, or the booking wasn’t approved yet, everything goes back.', {
                                deposit: formatVnd(180000),
                                back: formatVnd(90000),
                                kept: formatVnd(90000),
                            })}
                        />
                    ),
                    tip: t('The policy is in Rooms & prices; guests read the same lines when they book.'),
                },
                {
                    id: 'rooms',
                    title: t('Rooms & prices'),
                    body: t('Each room’s hourly price, how busy it is this week and this month, what it earned this month and its next booking. The pencil edits the room; See this room’s calendar shows that room alone. Under the rooms, Rented studios lists the studios where classes are taught, with their rent per hour.'),
                    example: (
                        <ExFields
                            title={`Phòng A · ${formatVnd(250000)} ${t('per hour')}`}
                            rows={[
                                { label: t('This week'), value: tn(5, '{count} booking', '{count} bookings') },
                                { label: t('This month'), value: tn(23, '{count} booking', '{count} bookings') },
                                { label: t('Revenue this month'), value: formatVnd(6250000), tone: 'good' },
                                { label: t('Next booking'), value: `${formatDate(tomorrow(), 'short')} · 20:30 – 22:00` },
                            ]}
                        />
                    ),
                    tip:
                        role === ROLES.admin
                            ? t('Beside the rooms is the cancellation policy: press Edit the policy to change when guests get money back.')
                            : t('Beside the rooms is the cancellation policy guests read; only an admin can change it.'),
                },
            ],
            outro: t('Press (?) at the top any time to see this again.'),
        };
    },
};
