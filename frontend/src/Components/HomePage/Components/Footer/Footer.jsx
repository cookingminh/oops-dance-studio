import { useEffect } from 'react'

//Imported logo
import logo from '@/assets/images/logo.webp'

//Imported icons
import { TiSocialFacebook } from "react-icons/ti";
import { SiTiktok } from "react-icons/si";
import { TiSocialInstagram } from "react-icons/ti";
import { TiSocialYoutube } from "react-icons/ti";

//Import AOS ==================>
import Aos from 'aos'
import 'aos/dist/aos.css'

const Footer = () => {
    //UseEffect to set animation duration====>
    useEffect(() => {
        Aos.init({ duration: 2000 })
    }, [])

    return (
        <div className='footer'>
            <div className="sectionContainer container grid ">
                <div data-aos='fade-up' data-aos-duration='2500' className="gridOne">
                    <div className="logoDiv">
                        <img src={logo} className='logo' />
                    </div>
                    <p>“Let Every Step Set You Free - Dance to Express, Not to Impress”</p>
                    <div className="socialIcon flex items-center justify-center">
                        <a href="https://www.facebook.com/oopsdancestudio">
                            <TiSocialFacebook className='icon' />
                        </a>
                        <a href="https://www.tiktok.com/@oopsdancestudio">
                            <SiTiktok className='icon' />
                        </a>
                        <a href="https://www.instagram.com/oopscrew.official">
                            <TiSocialInstagram className='icon' />
                        </a>
                        <a href="https://www.youtube.com/channel/UC7erFR2T4VW_rQnUOz2Tk_A">
                            <TiSocialYoutube className='icon' />
                        </a>
                    </div>
                </div>

                <div data-aos='fade-up' data-aos-duration='2500' className="footerLinks">
                    <span className="linkTitle">Information</span>
                    <li>
                        <a href="">Home</a>
                    </li>
                    <li>
                        <a href="">Explore</a>
                    </li>
                    <li>
                        <a href="">Room Status</a>
                    </li>
                    <li>
                        <a href="">Classes</a>
                    </li>
                    <li>
                        <a href="">Check-In/ Check-Out</a>
                    </li>
                    <li>
                        <a href="">Manage your booking</a>
                    </li>
                </div>
                <div data-aos='fade-up' data-aos-duration='2500' className="footerLinks">
                    <span className="linkTitle">Quick Guide</span>
                    <li>
                        <a href="">FAQ</a>
                    </li>
                    <li>
                        <a href="">How to</a>
                    </li>
                    <li>
                        <a href="">Feature</a>
                    </li>
                    <li>
                        <a href="">Information</a>
                    </li>
                    <li>
                        <a href="">Studio Map</a>
                    </li>
                    <li>
                        <a href="">Our Communities</a>
                    </li>
                </div>
                <div data-aos='fade-up' data-aos-duration='2500' className="footerLinks">
                    <span className="linkTitle">Partnership</span>
                    <li>
                        <a href="">Contact Us</a>
                    </li>
                    <li>
                        <a href="">Our Partners</a>
                    </li>
                    <li>
                        <a href="">Programme Rules</a>
                    </li>
                    <li>
                        <a href="">Careers</a>
                    </li>
                    <li>
                        <a href="">Products</a>
                    </li>
                    <li>
                        <a href="">Something</a>
                    </li>
                </div>

            </div>

            <div className="coppyRightDiv flex">
                <p>Oops! Dance Studio - 25 Trung Phung  | Web Developed by <a href="nminh.com" target='_blank'>Nminh</a></p>
            </div>
        </div>
    )
}

export default Footer