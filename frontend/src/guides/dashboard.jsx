import { LuCalendarDays, LuGraduationCap, LuHourglass, LuTicket, LuWallet } from 'react-icons/lu';
import { ROLES } from '@/auth/roles';
import { ExKey, ExList, ExStat } from '@/ui/guide/GuideExamples';

// The dashboard of admins and staff (/admin): this month's numbers, today's classes, booking requests,
// rooms and recent check-ins, and the to-do bell in the top bar. Admins' revenue card shows the whole
// month (tuition + rooms) with the profit so far; staff's shows room bookings only.
export default {
    id: 'admin-dashboard',
    build: ({ t, tn, intl }, { role }) => {
        const isAdmin = role === ROLES.admin;
        // Same short amounts as the stat cards ("27,3 Tr ₫" / "27.3M ₫").
        const compact = new Intl.NumberFormat(intl === 'en-GB' ? 'en' : intl, { notation: 'compact', maximumFractionDigits: 1 });
        const short = (amount) => `${compact.format(amount)} ₫`;

        return {
            id: 'admin-dashboard',
            title: t('Dashboard'),
            intro: t('Today at the studio on one page. Every card is a short preview: press it, or the link under it, to open the full page.'),
            sections: [
                {
                    id: 'numbers',
                    title: t('This month’s numbers'),
                    body: t('The four number cards count the month so far. Press a card to open the page behind it.'),
                    example: (
                        <ExKey
                            rows={[
                                {
                                    sample: <ExStat icon={LuTicket} value="48" label={t('Bookings this month')} color="hsl(350, 72%, 50%)" />,
                                    text: t('Every room booking made for this month.'),
                                },
                                {
                                    sample: <ExStat icon={LuGraduationCap} value="15" label={t('Enrolled students')} color="hsl(262, 55%, 55%)" />,
                                    text: t('Students in a class right now.'),
                                },
                                {
                                    sample: <ExStat icon={LuCalendarDays} value="2" label={t('Classes today')} color="hsl(36, 90%, 45%)" />,
                                    text: t('Classes on today’s timetable.'),
                                },
                                isAdmin
                                    ? {
                                          sample: (
                                              <ExStat
                                                  icon={LuWallet}
                                                  value={short(27300000)}
                                                  label={t('Revenue this month')}
                                                  note={t('Loss so far {amount}', { amount: short(3500000) })}
                                                  noteTone="bad"
                                                  color="hsl(152, 60%, 36%)"
                                              />
                                          ),
                                          text: t('Tuition and room bookings received this month. Under it: the profit (or loss) so far, once salaries and expenses are taken off. It opens Reports.'),
                                      }
                                    : {
                                          sample: <ExStat icon={LuWallet} value={short(11800000)} label={t('Revenue this month')} color="hsl(152, 60%, 36%)" />,
                                          text: t('Money received for room bookings this month. It opens Charts.'),
                                      },
                            ]}
                        />
                    ),
                    tip: isAdmin ? t('A loss so far isn’t the month’s result: it counts only up to today.') : null,
                },
                {
                    id: 'today',
                    title: t('Today’s Classes'),
                    body: t('Today’s classes in time order, with who teaches and the room. The tag on the right is the instructor’s check-in: waiting for approval until someone approves it, and “Live now” while the class is on. Press a class name to open the class.'),
                    example: (
                        <ExList
                            rows={[
                                { id: 'a', lead: '18:15', leadSub: '19:30', title: 'Girlstyle 1', sub: 'An Trinh · Studio Thỏ', tag: { label: t('Live now'), tone: 'live' } },
                                { id: 'b', lead: '18:30', leadSub: '19:45', title: 'Trending', sub: 'Đỗ Linh · Studio Thỏ', tag: { label: t('Pending'), tone: 'pending' } },
                                { id: 'c', lead: '20:00', leadSub: '21:15', title: 'Choreo BT', sub: 'Soleck · Bà Triệu', tag: { label: t('No record'), tone: 'muted' } },
                            ]}
                            callout={t('“{label}” means the class has no check-in record yet today; press it to open Attendance.', { label: t('No record') })}
                        />
                    ),
                },
                {
                    id: 'requests',
                    title: t('Booking requests'),
                    body: t('How many booking requests are waiting for approval. Press it to open them in Bookings, where you approve or reject each one with its payment in front of you.'),
                    example: <ExStat icon={LuHourglass} value="12" label={t('requests waiting for approval')} color="hsl(32, 88%, 40%)" />,
                },
                {
                    id: 'rooms-activity',
                    title: t('Rooms and recent check-ins'),
                    body: t('Rooms lists each room with its hourly price; it opens Rooms & prices. Recent Activity shows the latest instructor check-ins and check-outs, and says when a check-out was late.'),
                    example: (
                        <ExList
                            rows={[
                                { id: 'a', avatar: 'ĐA', title: `Đức Anh ${t('checked in to')} K-pop Dance`, sub: '18:22' },
                                { id: 'b', avatar: 'S', title: `Soleck ${t('checked out of')} Choreo BT`, sub: '21:31', tag: { label: t('Late check-out'), tone: 'late' } },
                            ]}
                        />
                    ),
                },
                {
                    id: 'bell',
                    title: t('The to-do bell'),
                    body: t('The bell at the top counts what needs doing across the studio, most urgent first. Press a line to go straight to it. It is there on every page, and the list empties as you do the work.'),
                    example: (
                        <ExList
                            rows={[
                                { id: 'a', dot: 'urgent', title: t('Review {who}’s session', { who: 'Vân Anh' }), sub: t('Needs attention now') },
                                { id: 'b', dot: 'urgent', title: t('Attendance not taken for {cls}', { cls: 'Girlstyle 2' }), sub: t('Needs attention now') },
                                { id: 'c', dot: 'normal', title: tn(4, '{count} booking request to review', '{count} booking requests to review'), sub: t('To do today') },
                                { id: 'd', dot: 'normal', title: tn(2, '{count} student is late with tuition', '{count} students are late with tuition'), sub: t('To do today') },
                                { id: 'e', dot: 'later', title: t('Take attendance for {cls}', { cls: 'Choreo BT' }), sub: t('Later today') },
                            ]}
                        />
                    ),
                },
            ],
            outro: t('Press (?) at the top any time to see this again.'),
        };
    },
};
