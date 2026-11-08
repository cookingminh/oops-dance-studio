import Slider from './Components/Slider';
import TimeTable from './Components/TimeTable';

const DanceClasses = ({ classes }) => (
    <div>
        <Slider classes={classes} />
        <TimeTable classes={classes} />
    </div>
);

export default DanceClasses;
