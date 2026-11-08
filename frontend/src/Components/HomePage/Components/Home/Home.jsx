import { useEffect } from 'react'

//Import Assets ===========>
import video from '@/assets/video/hero.mp4'
import aeroplane from '@/assets/images/logo-mark.webp'

//Import AOS ===============>
import Aos from 'aos'
import 'aos/dist/aos.css'

const Home = () => {
    //UseEffect to set animation duration====>
    useEffect(() => {
        Aos.init({ duration: 2000 })
    }, [])

    return (
        <div className='home flex container'>

            <div className="mainText flex">
                <h1 data-aos='fade-up' data-aos-duration='2500' className='text-5xl mb-4'>Create Slay Memories With Us!</h1>
            </div>

            <div data-aos='fade-down' data-aos-duration='2500' className="homeImages flex">

                <div className="videoDiv" >
                    <video src={video} autoPlay muted loop className='video'></video>
                </div>

                <img src={aeroplane} className="plane" />
            </div>
        </div>
    )
}

export default Home