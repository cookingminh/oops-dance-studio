import { useEffect } from 'react';
import Aos from 'aos';
import 'aos/dist/aos.css';
import AsyncState from '@/ui/feedback/AsyncState';
import { avatarUrl, classImageUrl } from '@/services/storage';
import placeholder from '@/assets/images/timetable-class-bg.webp';
import defaultAvatar from '@/assets/images/avatar-placeholder.webp';

// Classes and their instructors (public data only; students are never shown here).
const Participants = ({ classes }) => {
    useEffect(() => {
        Aos.init({ duration: 2000 });
    }, []);

    return (
        <div className="participants section bg-gradient-to-l from-yellow-500 to-red-500 p-4">
            <div className="sectionContainer">
                <h2
                    data-aos="fade-down"
                    data-aos-duration="2500"
                    className="text-6xl font-bold"
                    style={{
                        background: 'linear-gradient(to right, #1976D2, #F45E53)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    MEET OUR INSTRUCTORS
                </h2>
                <h2 data-aos="fade-down" data-aos-duration="2500" className="text-2xl font-semibold">
                    The people behind every class
                </h2>

                <AsyncState state={classes} emptyText="Our instructors will be introduced soon.">
                    {(list) => (
                        <div className="participantsContainer grid">
                            {list.map((item) => (
                                <div data-aos="fade-up" data-aos-duration="2500" key={item.id} className="singleparticipant">
                                    <img
                                        className="destinationImage"
                                        src={classImageUrl(item.image_path) ?? placeholder}
                                        alt={item.name}
                                        loading="lazy"
                                    />
                                    <div className="participantDetails">
                                        <div className="participantPicture">
                                            <img
                                                src={avatarUrl(item.instructor_avatar_path) ?? defaultAvatar}
                                                className="participantImage"
                                                alt={item.instructor_name}
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="participantName">
                                            <span>{item.instructor_name}</span>
                                            <p>{item.name}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </AsyncState>
            </div>
        </div>
    );
};

export default Participants;
