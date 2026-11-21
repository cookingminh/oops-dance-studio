import { useAsync } from '@/hooks/useAsync';
import { listPublicClasses } from '@/services/classes';
import Home from '../Components/Home/Home';
import Perks, { JoinBanner } from '../Components/Perks/Perks';
import Slider from '../Components/Classes/Components/Slider';
import JoinProvider from '../Components/Classes/Components/join/JoinProvider';

// /home: the studio in one screen (video, pitch, next class), why people join, a taste of the
// classes that leads on to /classes (students can ask to join from a card: JoinProvider), then sign up.
const HomeLanding = () => {
    const classes = useAsync(listPublicClasses, []);
    return (
        <JoinProvider classes={classes.data}>
            <Home classes={classes} />
            <Perks />
            <Slider classes={classes} />
            <JoinBanner />
        </JoinProvider>
    );
};

export default HomeLanding;
