import { MotionConfig } from 'framer-motion';
import { useAsync } from '@/hooks/useAsync';
import { listPublicClasses } from '@/services/classes';
import AboutHero from '../Components/About/AboutHero';
import AboutStory from '../Components/About/AboutStory';
import AboutTimeline from '../Components/About/AboutTimeline';
import AboutAchievements from '../Components/About/AboutAchievements';
import AboutCrew from '../Components/About/AboutCrew';
import AboutBeliefs from '../Components/About/AboutBeliefs';
import AboutGallery from '../Components/About/AboutGallery';
import AboutJoin from '../Components/About/AboutJoin';
import '../Components/About/about.scss';

// /about: Oops! Crew since 2017, read like a magazine feature in six short chapters, then an
// invitation to a free first class. Copy lives in Components/About/aboutContent.js.
const AboutPage = () => {
    const classes = useAsync(listPublicClasses, []);
    return (
        <MotionConfig reducedMotion="user">
            <article className="aboutPage">
                <AboutHero />
                <AboutStory />
                <AboutTimeline />
                <AboutAchievements />
                <AboutCrew classes={classes} />
                <AboutBeliefs />
                <AboutGallery />
                <AboutJoin />
            </article>
        </MotionConfig>
    );
};

export default AboutPage;
