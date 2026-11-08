import { useEffect, useMemo, useState } from 'react';
import { Button } from '@nextui-org/react';
import { format, parseISO } from 'date-fns';
import { TiSocialFacebook } from 'react-icons/ti';
import { getStudioToday } from '@/services/studio';
import { avatarUrl } from '@/services/storage';
import { WEEKDAYS, formatTime } from '@/lib/format';
import timetable_bg from '@/assets/images/timetable-bg.webp';
import class_bg from '@/assets/images/timetable-class-bg.webp';

// Weekly timetable built from every class's schedules (ISO weekday 1–7).
const TimeTable = ({ classes }) => {
    const [today, setToday] = useState(null);

    useEffect(() => {
        getStudioToday().then((iso) => setToday(parseISO(iso))).catch(() => setToday(new Date()));
    }, []);

    const { days, rows } = useMemo(() => {
        const sessions = (classes.data ?? []).flatMap((item) =>
            (item.schedules ?? []).map((s) => ({ ...s, start: formatTime(s.start_time), cls: item }))
        );
        const hasSunday = sessions.some((s) => s.day_of_week === 7);
        const shownDays = WEEKDAYS.filter((d) => d.value !== 7 || hasSunday);
        const starts = [...new Set(sessions.map((s) => s.start))].sort();
        return {
            days: shownDays,
            rows: starts.map((start) => ({
                start,
                cells: shownDays.map((d) => sessions.filter((s) => s.start === start && s.day_of_week === d.value)),
            })),
        };
    }, [classes.data]);

    return (
        <div className="classes section flex">
            <div className="sectionContainer flex">
                <div className="background">
                    <img src={timetable_bg} alt="" />
                </div>
                <div className="titlesDiv">
                    <h1>Our weekly timetable</h1>
                    {today && (
                        <>
                            <h1>{format(today, 'MMMM')}</h1>
                            <span>{format(today, 'yyyy')}</span>
                        </>
                    )}
                </div>

                <div className="timeTableDiv flex">
                    {rows.length === 0 ? (
                        <p className="z-10">{classes.loading ? 'Loading the timetable…' : 'The timetable will be published soon.'}</p>
                    ) : (
                        <table>
                            <thead>
                                <tr className="days">
                                    <th></th>
                                    {days.map((d) => (
                                        <th key={d.value} title={d.label}>{d.short}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.start}>
                                        <td className="time">{row.start}</td>
                                        {row.cells.map((sessions, index) => (
                                            <td key={days[index].value}>
                                                {sessions.map((s) => (
                                                    <div
                                                        className="dance-class !h-auto min-h-12 py-2"
                                                        key={s.cls.id}
                                                        title={`${s.cls.name} with ${s.cls.instructor_name}`}
                                                    >
                                                        <img src={class_bg} className="class-bg w-full h-full" alt="" />
                                                        {/* Small avatar on the badge corner so it never covers the class name. */}
                                                        {s.cls.instructor_avatar_path && (
                                                            <img
                                                                src={avatarUrl(s.cls.instructor_avatar_path)}
                                                                className="instructor !w-9 !h-9 !left-auto !-right-3 !-top-3 rounded-full object-cover object-top bg-white ring-2 ring-white"
                                                                alt={s.cls.instructor_name}
                                                            />
                                                        )}
                                                        {/* Class names from the DB can be long; keep them inside the badge. */}
                                                        <span className="!text-[11px] !leading-tight !w-[85%] !ml-4 !text-left [overflow-wrap:normal]">{s.cls.name}</span>
                                                    </div>
                                                ))}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="infoDiv mt-4 flex flex-col gap-2 text-center">
                    <h1>Go to our fanpage to get more information</h1>
                    <Button
                        as="a"
                        className="facebook-button"
                        aria-label="Facebook"
                        variant="bordered"
                        href="https://www.facebook.com/oopsdancestudio"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <TiSocialFacebook className="icon" /> Facebook
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TimeTable;
