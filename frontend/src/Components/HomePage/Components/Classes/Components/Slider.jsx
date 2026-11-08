import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import AsyncState from '@/ui/feedback/AsyncState';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatTimeRange, formatVnd, weekdayLabel } from '@/lib/format';
import placeholder from '@/assets/images/timetable-class-bg.webp';

// Classes carousel fed by list_public_classes().
const Slider = ({ classes }) => (
    <div className="container section flex flex-col gap-6 px-4">
        <h2 className="text-3xl font-bold text-center">Explore our dance classes</h2>
        <AsyncState state={classes} emptyText="New classes are coming soon.">
            {(list) => (
                <Swiper
                    modules={[Autoplay, Navigation, Pagination]}
                    navigation
                    pagination={{ clickable: true }}
                    autoplay={{ delay: 6000, disableOnInteraction: true }}
                    spaceBetween={24}
                    slidesPerView={1}
                    breakpoints={{ 768: { slidesPerView: 2 }, 1200: { slidesPerView: 3 } }}
                    className="w-full pb-10"
                >
                    {list.map((item) => (
                        <SwiperSlide key={item.id}>
                            <article className="bg-white rounded-2xl shadow-md overflow-hidden h-full flex flex-col">
                                <img
                                    src={classImageUrl(item.image_path) ?? placeholder}
                                    alt={item.name}
                                    loading="lazy"
                                    className="w-full h-56 object-cover"
                                />
                                <div className="p-4 flex flex-col gap-2 flex-1">
                                    <h3 className="text-xl font-bold">{item.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        {item.instructor_avatar_path && (
                                            <img
                                                src={avatarUrl(item.instructor_avatar_path)}
                                                alt=""
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        )}
                                        <span>with {item.instructor_name}</span>
                                        {item.room_name && <span>· {item.room_name}</span>}
                                    </div>
                                    {item.lesson && <p className="text-sm text-gray-700">{item.lesson}</p>}
                                    <ul className="text-sm text-gray-700">
                                        {(item.schedules ?? []).map((s) => (
                                            <li key={`${s.day_of_week}-${s.start_time}`}>
                                                {weekdayLabel(s.day_of_week)}: {formatTimeRange(s.start_time, s.end_time)}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-auto font-semibold text-red-700">{formatVnd(item.price)}</p>
                                </div>
                            </article>
                        </SwiperSlide>
                    ))}
                </Swiper>
            )}
        </AsyncState>
    </div>
);

export default Slider;
