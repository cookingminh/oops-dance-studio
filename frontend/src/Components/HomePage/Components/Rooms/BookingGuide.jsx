import { motion } from 'framer-motion';
import { LuCamera, LuFlipHorizontal2, LuHeartHandshake, LuMapPin, LuMessageCircle, LuMusic, LuSearch, LuSend, LuSpeaker, LuWallet } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { usePublicChrome } from '../NavBar/publicChrome';

const STEPS = [
    { icon: LuSearch, title: 'Find a free slot', text: 'Choose a room, a date and your hours. Free time shows in green.' },
    { icon: LuSend, title: 'Send your request', text: 'Log in and confirm. Your booking stays pending until the studio approves it.' },
    { icon: LuWallet, title: 'Pay the deposit', text: 'The studio contacts you about the 50% deposit, then approves your booking.' },
    { icon: LuMusic, title: 'Come and dance', text: 'Turn the music up and practise. Staff are on hand if you need anything.' },
];

const INCLUDED = [
    { icon: LuFlipHorizontal2, label: 'Wall-to-wall mirrors' },
    { icon: LuSpeaker, label: 'Quality sound system' },
    { icon: LuCamera, label: 'Filming and photo gear for rent' },
    { icon: LuHeartHandshake, label: 'Staff on hand to help' },
    { icon: LuMapPin, label: 'Close to the city centre' },
];

const EASE = [0.22, 1, 0.36, 1];
const list = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const rise = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

// /rooms: how a booking goes from search to dance floor, what every room has, and who to ask.
// (Replaces the old "Intro" and "Support" sections, which said the same things twice.)
const BookingGuide = () => {
    const { t } = useI18n();
    const { openContact } = usePublicChrome();
    return (
        <section id="how-it-works" className="hpGuide">
            <header className="hpSectionHead" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('How booking works')}</span>
                    <h2>{t('Plan your booking with confidence')}</h2>
                    <p>{t('Four steps from finding a slot to dancing in the room.')}</p>
                </div>
            </header>

            <motion.ol className="hpSteps" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
                {STEPS.map(({ icon: Icon, title, text }, index) => (
                    <motion.li key={title} className="hpStep" variants={rise}>
                        <span className="hpStepNo" aria-hidden="true">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="hpStepIcon" aria-hidden="true">
                            <Icon />
                        </span>
                        <h3>{t(title)}</h3>
                        <p>{t(text)}</p>
                    </motion.li>
                ))}
            </motion.ol>

            <div className="hpGuideFoot" data-aos="fade-up">
                <div className="hpIncluded">
                    <h3>{t('At the studio')}</h3>
                    <ul>
                        {INCLUDED.map(({ icon: Icon, label }) => (
                            <li key={label}>
                                <Icon aria-hidden="true" /> {t(label)}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="hpHelp">
                    <h3>{t('Not sure which room suits you?')}</h3>
                    <p>{t('Tell us how many dancers are coming and what you’re planning, and we’ll help you choose.')}</p>
                    <button type="button" className="hpHelpBtn" onClick={openContact}>
                        <LuMessageCircle aria-hidden="true" /> {t('Ask the studio')}
                    </button>
                </div>
            </div>
        </section>
    );
};

export default BookingGuide;
