import { LuClipboardCheck, LuListChecks, LuReceipt, LuTicket } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { ExControls, ExList, ExTable, ExTags } from '@/ui/guide/GuideExamples';

// The Activity page (admins only): the period and its overview, reading the timeline, filtering, and an
// entry's details (what changed, the record's history).
export default {
    id: 'admin-activity',
    build: ({ t }) => {
        const admin = { label: t('Admin'), tone: 'role' };
        const instructor = { label: t('Instructor'), tone: 'muted' };

        return {
            id: 'admin-activity',
            title: t('Activity'),
            intro: t('Everything people do in the app, as a timeline: who did what, and when. Use it to check a change, or to catch up on what happened while you were away.'),
            sections: [
                {
                    id: 'period',
                    title: t('Pick a period'),
                    body: t('Choose Today, Yesterday, Last 7 days, This month, or Custom for your own dates. The card under it counts the actions, shows the busiest people and splits everything by area.'),
                    example: (
                        <>
                            <ExControls items={[{ label: t('Today') }, { label: t('Yesterday') }, { label: t('Last 7 days'), on: true }, { label: t('This month') }]} />
                            <ExTags
                                items={[
                                    { label: t('Bookings'), count: 57, icon: LuTicket },
                                    { label: t('Roll call'), count: 59, icon: LuListChecks, on: true },
                                    { label: t('Class sessions'), count: 25, icon: LuClipboardCheck },
                                    { label: t('Tuition'), count: 17, icon: LuReceipt },
                                ]}
                                callout={t('Press an area, or one of the busiest people, to see only theirs; press it again to see everything.')}
                            />
                        </>
                    ),
                    tip: t('“Live” means new actions turn up by themselves every minute. Refresh fetches them right away.'),
                },
                {
                    id: 'timeline',
                    title: t('Reading the timeline'),
                    body: t('Newest first, one block per day. Each line is a sentence — who did what, to what — with their role and the time. Several actions in a row by one person on the same thing fold into one line: Show all opens them.'),
                    example: (
                        <ExList
                            rows={[
                                {
                                    id: 'a',
                                    avatar: 'TH',
                                    title: t('{actor} changed {name}’s booking price {from} → {to}', { actor: 'Thu Hà', name: 'Vũ Đức Anh', from: formatVnd(400000), to: formatVnd(360000) }),
                                    sub: '17:23',
                                    tag: admin,
                                },
                                {
                                    id: 'b',
                                    avatar: 'TH',
                                    title: t('{actor} approved {name}’s booking', { actor: 'Thu Hà', name: 'Vũ Đức Anh' }),
                                    sub: '17:22',
                                    tag: admin,
                                    more: t('Show all {count}', { count: 3 }),
                                },
                                { id: 'c', avatar: 'ĐA', title: t('{actor} checked in to {class}', { actor: 'Đức Anh', class: 'K-pop Dance' }), sub: '18:22', tag: instructor },
                            ]}
                        />
                    ),
                    tip: t('Under Timeline you can also pick a person or an action type, or search a name or a class. Clear filters brings everything back.'),
                },
                {
                    id: 'details',
                    title: t('What exactly changed'),
                    body: t('Press a line to open it on the right: the exact time, who did it, what changed (before → after), everything else that happened to the same record, and a link to open it where it lives.'),
                    example: (
                        <ExTable
                            head={[t('Field'), t('Before'), t('After')]}
                            rows={[
                                [t('Status'), t('Pending'), t('Approved')],
                                [t('Room hire'), formatVnd(400000), formatVnd(360000)],
                            ]}
                            callout={t('Booking #226: approved, and its price lowered for a regular customer.')}
                        />
                    ),
                    tip: t('Other pages link here too: a person’s or a class’s activity opens this page already filtered to them.'),
                },
            ],
            outro: t('Press (?) at the top any time to see this again.'),
        };
    },
};
