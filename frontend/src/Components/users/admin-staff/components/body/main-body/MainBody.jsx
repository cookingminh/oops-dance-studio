import './main_body.scss'
import Top from './top/Top'
import Listing from './listing/Listing'
import Activity from './activity/Activity'


const MainBody = () => {
    return (
        <div className='mainBody' >
            <Top />
            <div className="bottom flex" >
                <Listing /> <Activity />
            </div>
        </div>
    )
}

export default MainBody