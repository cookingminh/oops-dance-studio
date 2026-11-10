import { useAsync } from '@/hooks/useAsync';
import { listPublicClasses } from '@/services/classes';
import Home from '../Components/Home/Home';
import Perks, { JoinBanner } from '../Components/Perks/Perks';
import Slider from '../Components/Classes/Components/Slider';

// /home: the studio in one screen (video, pitch, next class), why people join, a taste of the
// classes that leads on to /classes, then sign up.
const HomeLanding = () => {
    const classes = useAsync(listPublicClasses, []);
    return (
        <>
            <Home classes={classes} />
            <Perks classes={classes} />
            <Slider classes={classes} />
            <JoinBanner />
        </>
    );
};

export default HomeLanding;
