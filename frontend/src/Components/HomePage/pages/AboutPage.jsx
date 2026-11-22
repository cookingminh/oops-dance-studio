import AboutHero from '../Components/About/AboutHero';
import AboutStory from '../Components/About/AboutStory';
import AboutCrew from '../Components/About/AboutCrew';
import AboutTimeline from '../Components/About/AboutTimeline';
import AboutHighlights from '../Components/About/AboutHighlights';
import AboutVideos from '../Components/About/AboutVideos';
import AboutSocials from '../Components/About/AboutSocials';
import '../Components/About/about.scss';

// /about: Oops! Crew since 2014 (the hero and its numbers, the story, meet the crew, the timeline,
// the biggest wins, videos, then socials and the way into a class). No data from the backend: every
// word, number, photo and link comes from src/content/about.js.
const AboutPage = () => (
    <article className="aboutPage">
        <AboutHero />
        <AboutStory />
        <AboutCrew />
        <AboutTimeline />
        <AboutHighlights />
        <AboutVideos />
        <AboutSocials />
    </article>
);

export default AboutPage;
