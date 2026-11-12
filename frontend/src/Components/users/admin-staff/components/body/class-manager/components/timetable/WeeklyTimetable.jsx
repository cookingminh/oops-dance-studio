import { motion } from 'framer-motion';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@nextui-org/react';
import { LuClock, LuPlus } from 'react-icons/lu';
import { WEEKDAYS, formatTime, isoWeekdayOf } from '@/lib/format';
import { placeOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../../common/SectionCard';
import { SERIES } from '../../../../common/chartTheme';
import { fadeUp, stagger } from '../../../../common/motion';

const NO_PLACE = 'hsl(240, 4%, 60%)';

// Monday → Sunday columns; each block is one weekly session, tinted with its place's colour: a room keeps
// its colour, the rented studios in use take the next ones. Clicking a block opens edit / delete.
const WeeklyTimetable = ({ state, today, rooms, roomColor, actions }) => {
    const { t, dayName } = useI18n();
    const sessions = (state.data ?? []).flatMap((cls) =>
        cls.schedules.map((schedule) => ({ ...schedule, class_id: cls.id, cls }))
    );
    const todayDow = today ? isoWeekdayOf(today) : null;
    const venues = [...new Map((state.data ?? []).filter((cls) => cls.venue).map((cls) => [cls.venue.id, cls.venue])).values()].sort((a, b) => a.id - b.id);
    const venueColor = new Map(venues.map((venue, index) => [venue.id, SERIES[((rooms ?? []).length + index) % SERIES.length]]));
    const colorOf = (cls) => (cls.venue_id ? venueColor.get(cls.venue_id) : roomColor.get(cls.room_id)) ?? NO_PLACE;
    const legend = [
        ...(rooms ?? []).map((room) => ({ key: `room-${room.id}`, name: room.name, color: roomColor.get(room.id) })),
        ...venues.map((venue) => ({ key: `venue-${venue.id}`, name: venue.name, color: venueColor.get(venue.id) })),
    ];

    return (
        <SectionCard
            className="classScheduleDiv"
            icon={LuClock}
            title={t('Weekly timetable')}
            subtitle={t('{count} sessions a week · colours show where', { count: sessions.length })}
            actions={
                <>
                    <span className="roomLegend">
                        {legend.map((item) => (
                            <span key={item.key}>
                                <span className="segDot" style={{ background: item.color }} aria-hidden="true" />
                                {item.name}
                            </span>
                        ))}
                    </span>
                    <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} onPress={actions.add}>
                        {t('Add session')}
                    </Button>
                </>
            }
        >
            <AsyncState state={state} isEmpty={false}>
                <div className="timetableScroll">
                    <motion.div className="timetable" variants={stagger} initial="hidden" animate="show" role="list" aria-label={t('Weekly timetable')}>
                        {WEEKDAYS.map((day) => {
                            const daySessions = sessions
                                .filter((s) => s.day_of_week === day.value)
                                .sort((a, b) => a.start_time.localeCompare(b.start_time));
                            return (
                                <motion.div key={day.value} variants={fadeUp} className={`dayColumn${day.value === todayDow ? ' isToday' : ''}`} role="listitem">
                                    <div className="dayHead">
                                        <strong>{dayName(day.value, 'short')}</strong>
                                        {day.value === todayDow ? <span className="todayTag">{t('Today')}</span> : <span>{daySessions.length || ''}</span>}
                                    </div>
                                    <div className="dayBody">
                                        {daySessions.length === 0 && <span className="dayEmpty">{t('Free')}</span>}
                                        {daySessions.map((s) => (
                                            <Dropdown key={s.id}>
                                                <DropdownTrigger>
                                                    <button
                                                        type="button"
                                                        className="slotBlock"
                                                        style={{ '--room': colorOf(s.cls) }}
                                                        aria-label={t('{name}, {day} {start} to {end}', {
                                                            name: s.cls.name,
                                                            day: dayName(day.value),
                                                            start: formatTime(s.start_time),
                                                            end: formatTime(s.end_time),
                                                        })}
                                                    >
                                                        <span className="slotTime">
                                                            {formatTime(s.start_time)}–{formatTime(s.end_time)}
                                                        </span>
                                                        <strong>{s.cls.name}</strong>
                                                        <span className="slotRoom">{placeOf(s.cls).name ?? t('No room')}</span>
                                                    </button>
                                                </DropdownTrigger>
                                                <DropdownMenu aria-label={t('Session actions')}>
                                                    <DropdownItem key="edit" onPress={() => actions.edit(s)}>{t('Edit session')}</DropdownItem>
                                                    <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => actions.remove(s)}>
                                                        {t('Delete session')}
                                                    </DropdownItem>
                                                </DropdownMenu>
                                            </Dropdown>
                                        ))}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </div>
            </AsyncState>
        </SectionCard>
    );
};

export default WeeklyTimetable;
