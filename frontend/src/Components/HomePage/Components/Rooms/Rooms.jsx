import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Keyboard, Navigation } from 'swiper/modules';
import { LuCalendarCheck, LuChevronLeft, LuChevronRight, LuRuler } from 'react-icons/lu';
import 'swiper/css';
import { roomImageUrls } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import studioPhoto from '@/assets/images/studio.webp';
import './Rooms.scss';

const EASE = [0.22, 1, 0.36, 1];
const grid = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const rise = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

// rooms.size is free text such as "80 m² · gương 2 mặt · loa JBL": one chip per part.
const featuresOf = (room) => (room.size ?? '').split('·').map((part) => part.trim()).filter(Boolean);

const RoomCard = ({ room, onBook }) => {
    const { t } = useI18n();
    const photos = roomImageUrls(room);
    const slides = photos.length > 0 ? photos : [studioPhoto]; // room without photos yet
    const prevRef = useRef(null);
    const nextRef = useRef(null);
    const [current, setCurrent] = useState(0);
    const features = featuresOf(room);

    return (
        <motion.article className="pubRoom room1" variants={rise}>
            <div className="pubRoomMedia">
                <Swiper
                    modules={[A11y, Keyboard, Navigation]}
                    rewind
                    grabCursor
                    keyboard={{ enabled: true, onlyInViewport: true }}
                    onBeforeInit={(swiper) => {
                        // The arrow buttons render next to the Swiper; hand them over before it initialises.
                        swiper.params.navigation.prevEl = prevRef.current;
                        swiper.params.navigation.nextEl = nextRef.current;
                    }}
                    navigation={{ prevEl: prevRef.current, nextEl: nextRef.current }}
                    onSlideChange={(swiper) => setCurrent(swiper.realIndex)}
                    className="pubRoomSwiper"
                >
                    {slides.map((src, index) => (
                        <SwiperSlide key={src}>
                            <img src={src} alt={t('{name} — photo {number}', { name: room.name, number: index + 1 })} loading="lazy" />
                        </SwiperSlide>
                    ))}
                </Swiper>
                <div className={`pubRoomNav${slides.length > 1 ? '' : ' isHidden'}`}>
                    <button ref={prevRef} type="button" aria-label={t('Previous photo')}>
                        <LuChevronLeft />
                    </button>
                    <button ref={nextRef} type="button" aria-label={t('Next photo')}>
                        <LuChevronRight />
                    </button>
                </div>
                {slides.length > 1 && (
                    <span className="pubRoomCount" aria-hidden="true">
                        {current + 1} / {slides.length}
                    </span>
                )}
                <span className="pubRoomPrice">
                    {formatVnd(room.price)} <small>{t('/ hour')}</small>
                </span>
            </div>

            <div className="pubRoomBody">
                <div>
                    <h3>{room.name}</h3>
                    {features.length > 0 && (
                        <ul className="pubRoomFeatures">
                            {features.map((feature, index) => (
                                <li key={feature}>
                                    {index === 0 && <LuRuler aria-hidden="true" />}
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button type="button" className="pubRoomBook" onClick={() => onBook(room.id)}>
                    <LuCalendarCheck aria-hidden="true" /> {t('Book {room}', { room: room.name })}
                </button>
            </div>
        </motion.article>
    );
};

// /rooms: every room with its photos, size and price. "Book" picks the room in the booking card above.
const Rooms = ({ rooms, onBook }) => {
    const { t } = useI18n();
    return (
        <section id="rooms" className="rooms pubRooms">
            <header className="hpSectionHead" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('The rooms')}</span>
                    <h2>{t('Your space to practise')}</h2>
                    <p>{t('Wall-to-wall mirrors and a proper sound system in every room. Swipe through the photos, then book the one you like.')}</p>
                </div>
            </header>
            <AsyncState state={rooms} emptyText="Our rooms will be listed soon.">
                {(list) => (
                    <motion.div className="pubRoomGrid" variants={grid} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
                        {list.map((room) => (
                            <RoomCard key={room.id} room={room} onBook={onBook} />
                        ))}
                    </motion.div>
                )}
            </AsyncState>
        </section>
    );
};

export default Rooms;
