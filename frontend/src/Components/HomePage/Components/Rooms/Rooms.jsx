import { useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/navigation';
import Aos from 'aos';
import 'aos/dist/aos.css';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { roomImageUrls } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import studioPhoto from '@/assets/images/studio.webp';

const RoomCard = ({ room }) => {
    const photos = roomImageUrls(room);
    const slides = photos.length > 0 ? photos : [studioPhoto]; // room without photos yet
    return (
        <div className="room1 flex font-semibold">
            <div className="headerDiv">
                <h1>{room.name.toUpperCase()}</h1>
            </div>
            <div className="roomsDetail flex">
                <div className="roomImages">
                    <Swiper
                        className="swiper"
                        effect="coverflow"
                        grabCursor
                        centeredSlides
                        loop={slides.length > 2}
                        slidesPerView="auto"
                        coverflowEffect={{ rotate: 0, stretch: 50, depth: 100, modifier: 2.5 }}
                        navigation={slides.length > 1}
                        modules={[EffectCoverflow, Navigation]}
                    >
                        {slides.map((src, index) => (
                            <SwiperSlide className="swiper-slide" key={src}>
                                <img src={src} alt={`${room.name} — photo ${index + 1}`} loading="lazy" />
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
                <div className="textDiv">
                    {room.size && <h1>{room.size}</h1>}
                    <p className="text-sm font-normal">{formatVnd(room.price)} / hour</p>
                </div>
            </div>
        </div>
    );
};

const Rooms = () => {
    const rooms = useAsync(listRooms, []);

    useEffect(() => {
        Aos.init({ duration: 2000 });
    }, []);

    return (
        <div className="rooms section flex">
            <div className="sectionContainer container flex">
                <h1 className="text-3xl font-bold">WELCOME TO OUR SPACE</h1>
                <p className="text-lg font-semibold">
                    {rooms.data?.length ? `Explore our studio with ${rooms.data.length} modern rooms` : 'Explore our studio'}
                </p>
                <AsyncState state={rooms} emptyText="Our rooms will be listed soon.">
                    {(list) => list.map((room) => <RoomCard key={room.id} room={room} />)}
                </AsyncState>
            </div>
        </div>
    );
};

export default Rooms;
