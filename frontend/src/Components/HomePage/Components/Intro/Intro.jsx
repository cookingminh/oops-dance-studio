import { useEffect } from 'react'

//Imported Images ======>
import imageGrid from '@/assets/images/studio.webp'

//Import AOS ==================>
import Aos from 'aos'
import 'aos/dist/aos.css'


const Intro = () => {
    //UseEffect to set animation duration====>
    useEffect(() => {
        Aos.init({ duration: 2000 })
    }, [])

    return (
        < div className='intro container section' >
            <div className="sectionContainer grid">
                <div data-aos='fade-left' data-aos-duration='2500' className="imgDiv">
                    <img src={imageGrid} />
                </div>
                <div className="textDiv">
                    <h2 data-aos='fade-down' data-aos-duration='2500' className='text-3xl font-semibold'>Dance, Thrive - A Studio That Makes A Difference </h2>

                    <div className="grids grid">

                        <div data-aos='fade-down' data-aos-duration='2500' className="singleGrid">
                            <span className='gridTitle'>
                                High-quality dance studio system
                            </span>
                            <p>
                                We provide two distinct types of studios, meticulously designed to cater to every
                                individual need.
                            </p>
                        </div>

                        <div data-aos='fade-down' data-aos-duration='2500' className="singleGrid">
                            <span className='gridTitle'>
                                Modern facilities
                            </span>
                            <p>
                                Additionally, we offer rental services for professional equipment,
                                fully supporting your filming and photography needs.
                            </p>
                        </div>

                        <div data-aos='fade-down' data-aos-duration='2500' className="singleGrid">
                            <span className='gridTitle'>
                                Always ready to assist
                            </span>
                            <p>
                                Our studio staff are always on hand and ready to provide immediate assistance
                                should any unexpected issues arise.
                            </p>
                        </div>

                        <div data-aos='fade-down' data-aos-duration='2500' className="singleGrid">
                            <span className='gridTitle'>
                                Conveniently located studio
                            </span>
                            <p>
                                Our studio is strategically located near the city center, ensuring
                                maximum convenience for your commute.
                            </p>
                        </div>


                    </div>
                </div>
            </div>

        </div >
    )

}

export default Intro