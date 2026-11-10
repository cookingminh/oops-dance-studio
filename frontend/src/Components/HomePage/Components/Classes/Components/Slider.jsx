import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from 'swiper/modules';
import { LuArrowRight, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import 'swiper/css';
import AsyncState from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import ClassCard from './ClassCard';

// /home teaser: the classes carousel (list_public_classes()), leading on to /classes for the full
// timetable. The arrows sit left and right of the cards (outside them, never on top); the dots under them.
const Slider = ({ classes }) => {
    const { t } = useI18n();
    return (
        <section className="hpClasses">
            <header className="hpSectionHead" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('Classes')}</span>
                    <h2>{t('Explore our dance classes')}</h2>
                    <p>{t('From K-pop covers to breaking for kids: every class, who teaches it and when it meets.')}</p>
                </div>
                <Link to="/classes#timetable" className="hpHeadLink">
                    {t('See the timetable')} <LuArrowRight aria-hidden="true" />
                </Link>
            </header>

            <AsyncState state={classes} emptyText="New classes are coming soon.">
                {(list) => (
                    <div data-aos="fade-up" data-aos-delay="80">
                        <div className="hpCarousel">
                            <button type="button" className="hpNavBtn hpClassesPrev" aria-label={t('Previous classes')}>
                                <LuChevronLeft />
                            </button>
                            <Swiper
                                modules={[A11y, Autoplay, Keyboard, Navigation, Pagination]}
                                navigation={{ prevEl: '.hpClassesPrev', nextEl: '.hpClassesNext' }}
                                pagination={{ el: '.hpClassesDots', clickable: true }}
                                keyboard={{ enabled: true }}
                                autoplay={{ delay: 6000, disableOnInteraction: true, pauseOnMouseEnter: true }}
                                spaceBetween={24}
                                slidesPerView={1.08}
                                breakpoints={{ 640: { slidesPerView: 2 }, 1100: { slidesPerView: 3 } }}
                                className="hpClassesSwiper"
                            >
                                {list.map((item) => (
                                    <SwiperSlide key={item.id}>
                                        <ClassCard item={item} />
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                            <button type="button" className="hpNavBtn hpClassesNext" aria-label={t('Next classes')}>
                                <LuChevronRight />
                            </button>
                        </div>
                        <div className="hpClassesDots" />
                    </div>
                )}
            </AsyncState>
        </section>
    );
};

export default Slider;
