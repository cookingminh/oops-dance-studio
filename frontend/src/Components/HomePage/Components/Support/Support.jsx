import { useEffect } from 'react'

//Imported Images ===========>
import gridImage from "@/assets/images/room1-3.webp"
//Import AOS ==================>
import Aos from 'aos'
import 'aos/dist/aos.css'

const Support = () => {
    //UseEffect to set animation duration====>
    useEffect(() => {
        Aos.init({ duration: 2000 })
    }, [])

    return (
        <div className='support container section'>
            <div className="sectionContainer">
                <div className="titlesDiv">
                    <small >studio support</small>
                    <h2 className='font-bold'>Plan your booking with confidence</h2>
                    <p>Find help with booking and dancing plans, see what to expect
                        along the journey!</p>
                </div>

                <div className="infoDiv grid">
                    <div className="textDiv grid">

                        <div data-aos='fade-down' data-aos-duration='2500' className="singleInfo">
                            <span className='number'>01</span>
                            <h4>Easy Booking Process</h4>
                            <p>
                                We offer a smooth online booking process that allows you to easily select and reserve the dance studio space that meets your needs.
                            </p>
                        </div>

                        <div data-aos='fade-down' data-aos-duration='3500' className="singleInfo">
                            <span className='number colorOne'>02</span>
                            <h4>Studio Amenities</h4>
                            <p>
                                Each studio is fully equipped with amenities ranging from wall-to-wall mirrors to high-quality sound systems, ensuring an ideal practice environment.
                            </p>
                        </div>

                        <div data-aos='fade-down' data-aos-duration='4500' className="singleInfo">
                            <span className='number colorTwo'>03</span>
                            <h4>Professional Support</h4>
                            <p>
                                Our team is always ready to assist you with any issues, from technical support to advice on choosing the right studio space, ensuring a hassle-free rental experience.
                            </p>
                        </div>


                    </div>

                    <div data-aos='fade-left' data-aos-duration='2500' className="imgDiv">
                        <img src={gridImage} />
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Support