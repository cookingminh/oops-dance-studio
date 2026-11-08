import SideBar from './components/sidebar/SideBar'
import Body from './components/body/Body'

const Admin = () => {
    return (
        <div className='dashBoardContainer flex'>
            <SideBar />
            <Body />
        </div>
    )
}

export default Admin