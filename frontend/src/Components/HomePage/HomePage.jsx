import { useRef } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { listPublicClasses } from '@/services/classes';
import Navbar from './Components/NavBar/Navbar';
import Home from './Components/Home/Home';
import Search from './Components/Search/Search';
import Support from './Components/Support/Support';
import Rooms from './Components/Rooms/Rooms';
import Participants from './Components/Participants/Participants';
import Subscribers from './Components/Subscribers/Subscribers';
import Footer from './Components/Footer/Footer';
import Intro from './Components/Intro/Intro';
import DanceClasses from './Components/Classes/DanceClasses';

const HomePage = () => {
    const homeRef = useRef(null);
    const aboutRef = useRef(null);
    const roomsRef = useRef(null);
    const classesRef = useRef(null);
    // One public call feeds the class slider, the timetable and the instructors section.
    const classes = useAsync(listPublicClasses, []);

    const scrollToSection = (sectionRef) => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="homePage">
            <Navbar scrollToSection={scrollToSection} refs={{ homeRef, aboutRef, roomsRef, classesRef }} />
            <div ref={homeRef}>
                <Home />
            </div>
            <div ref={aboutRef}>
                <Intro />
            </div>
            <div ref={roomsRef}>
                <Rooms />
            </div>
            <Search />
            <Support />
            <div ref={classesRef}>
                <DanceClasses classes={classes} />
            </div>
            <Participants classes={classes} />
            <Subscribers />
            <Footer />
        </div>
    );
};

export default HomePage;
