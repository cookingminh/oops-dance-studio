import { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input } from '@nextui-org/react';
import { LuAlertTriangle, LuCalendarDays, LuMusic, LuPlus, LuSearch } from 'react-icons/lu';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { WEEKDAYS, formatTime, formatVnd } from '@/lib/format';
import { lessonState, monthLabel } from '@/lib/lessons';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { VerticalDotsIcon } from '../../../../../../../Table/VerticalDotsIcon';
import SectionCard from '../../../../common/SectionCard';
import { fadeUp, stagger } from '../../../../common/motion';

const shortDay = (day) => WEEKDAYS.find((item) => item.value === day)?.label.slice(0, 3);
const bySession = (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time);

// Every class as a card: who teaches it, where, its price, this month's lesson and its weekly sessions.
// A class without a lesson for the current month keeps showing its latest one, flagged in amber.
const ClassesBoard = ({ state, today, roomColor, actions }) => {
    const [query, setQuery] = useState('');
    const list = state.data ?? [];
    const term = query.trim().toLowerCase();
    const visible = list.filter((cls) =>
        !term || [cls.name, cls.instructor?.full_name, cls.instructor?.username, cls.room?.name, cls.lesson]
            .some((value) => String(value ?? '').toLowerCase().includes(term))
    );
    const stale = list.filter((cls) => lessonState(cls.lessons, today).needsUpdate);
    const thisMonth = today ? monthLabel(`${today.slice(0, 7)}-01`) : '';

    let subtitle = 'Loading classes…';
    if (state.data) {
        const lessons = stale.length
            ? `${stale.length} need${stale.length === 1 ? 's' : ''} ${thisMonth}’s lesson`
            : `every lesson is set for ${thisMonth}`;
        subtitle = `${list.length} class${list.length === 1 ? '' : 'es'} · ${lessons}`;
    }

    return (
        <SectionCard
            className="classListDiv"
            icon={LuCalendarDays}
            title="Classes"
            subtitle={subtitle}
            actions={
                <>
                    <Input
                        isClearable
                        aria-label="Search classes"
                        placeholder="Search..."
                        className="bookingSearch"
                        startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                        value={query}
                        onValueChange={setQuery}
                        onClear={() => setQuery('')}
                    />
                    <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={actions.create}>
                        New class
                    </Button>
                </>
            }
        >
            {stale.length > 0 && (
                <p className="inlineNotice">
                    <LuMusic aria-hidden="true" />
                    <span>
                        <strong>{stale.map((cls) => cls.name).join(', ')}</strong> {stale.length === 1 ? 'is' : 'are'} still showing an
                        older lesson. Set {thisMonth}’s piece so students know what they’re learning.
                    </span>
                </p>
            )}
            <AsyncState state={state} isEmpty={visible.length === 0} emptyText={term ? 'No class matches your search.' : 'No classes yet.'}>
                <motion.div className="classGrid" variants={stagger} initial="hidden" animate="show">
                    {visible.map((cls) => {
                        const lesson = lessonState(cls.lessons, today);
                        const instructor = cls.instructor?.full_name || cls.instructor?.username || 'No instructor';
                        const sessions = [...cls.schedules].sort(bySession);
                        return (
                            <motion.article key={cls.id} variants={fadeUp} className={`classCard${lesson.needsUpdate ? ' needsLesson' : ''}`}>
                                <div className="classCardMedia">
                                    {cls.image_path ? (
                                        <img src={classImageUrl(cls.image_path)} alt={cls.name} />
                                    ) : (
                                        <span className="classPlaceholder" aria-hidden="true">
                                            <LuMusic />
                                        </span>
                                    )}
                                    {cls.room && (
                                        <span className="roomPill onImage">
                                            <span className="segDot" style={{ background: roomColor.get(cls.room_id) }} aria-hidden="true" />
                                            {cls.room.name}
                                        </span>
                                    )}
                                    <span className="classPrice">{formatVnd(cls.price)}</span>
                                </div>

                                <div className="classCardBody">
                                    <div className="classCardHead">
                                        <h3>{cls.name}</h3>
                                        <Dropdown>
                                            <DropdownTrigger>
                                                <Button isIconOnly size="sm" variant="light" aria-label={`Actions for ${cls.name}`}>
                                                    <VerticalDotsIcon className="text-default-400" />
                                                </Button>
                                            </DropdownTrigger>
                                            <DropdownMenu aria-label="Class actions">
                                                <DropdownItem key="edit" onPress={() => actions.edit(cls)}>Edit class information</DropdownItem>
                                                <DropdownItem key="lesson" onPress={() => actions.lesson(cls)}>Monthly lessons</DropdownItem>
                                                <DropdownItem key="session" onPress={() => actions.addSession(cls)}>Add a weekly session</DropdownItem>
                                                <DropdownItem key="image" onPress={() => actions.image(cls)}>Change class image</DropdownItem>
                                                <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => actions.remove(cls)}>
                                                    Delete class
                                                </DropdownItem>
                                            </DropdownMenu>
                                        </Dropdown>
                                    </div>

                                    <div className="classInstructor">
                                        <Avatar
                                            {...AVATAR_DEFAULTS}
                                            size="sm"
                                            src={avatarUrl(cls.instructor?.avatar_path, cls.instructor?.updated_at) ?? undefined}
                                            name={instructor}
                                        />
                                        <span>{instructor}</span>
                                    </div>

                                    <button type="button" className={`lessonBox${lesson.needsUpdate ? ' isStale' : ''}`} onClick={() => actions.lesson(cls)}>
                                        <span className="lessonIcon" aria-hidden="true">
                                            {lesson.needsUpdate ? <LuAlertTriangle /> : <LuMusic />}
                                        </span>
                                        <span className="lessonText">
                                            <small>
                                                {lesson.needsUpdate
                                                    ? lesson.latest ? `Still ${monthLabel(lesson.latest.month)}’s lesson` : `No lesson for ${thisMonth}`
                                                    : `${thisMonth}’s lesson`}
                                            </small>
                                            <strong>{lesson.latest?.title ?? 'No lesson yet'}</strong>
                                        </span>
                                        <span className="lessonAction">{lesson.needsUpdate ? 'Set' : 'Change'}</span>
                                    </button>

                                    <div className="sessionChips">
                                        {sessions.length === 0 ? (
                                            <button type="button" className="sessionChip isEmpty" onClick={() => actions.addSession(cls)}>
                                                + Add a weekly session
                                            </button>
                                        ) : (
                                            sessions.map((s) => (
                                                <span key={s.id} className="sessionChip">
                                                    <strong>{shortDay(s.day_of_week)}</strong> {formatTime(s.start_time)}–{formatTime(s.end_time)}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.article>
                        );
                    })}
                </motion.div>
            </AsyncState>
        </SectionCard>
    );
};

export default ClassesBoard;
