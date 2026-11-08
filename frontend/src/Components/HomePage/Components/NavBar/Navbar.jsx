import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiMenu } from 'react-icons/hi';
import { useDisclosure } from '@nextui-org/react';
import { useAuth } from '@/auth/useAuth';
import logo from '@/assets/images/logo.webp';
import AvatarUser from './AvatarUser';
import ContactModal from './ContactModal';

const Navbar = ({ scrollToSection, refs }) => {
    const { isOpen: isContactOpen, onOpen: onContactOpen, onOpenChange: onContactOpenChange } = useDisclosure();
    const { isAuthenticated } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY >= 10);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const goTo = (ref) => {
        setMenuOpen(false);
        scrollToSection(ref);
    };

    const contactHandler = () => {
        setMenuOpen(false);
        onContactOpen();
    };

    return (
        <div className="navBar flex items-center">
            <div className={scrolled ? 'navBarTwo navbar_With_Bg' : 'navBarTwo'}>
                <div className="logoDiv">
                    <img src={logo} className="logo" alt="Oops! Dance Studio" />
                    <div className={menuOpen ? 'navBarMenu showNavBar' : 'navBarMenu'}>
                        <ul className="menu flex items-center">
                            <li onClick={() => goTo(refs.homeRef)} className="listItem">Home</li>
                            <li onClick={() => goTo(refs.aboutRef)} className="listItem">About</li>
                            <li onClick={() => goTo(refs.roomsRef)} className="listItem">Room</li>
                            <li onClick={() => goTo(refs.classesRef)} className="listItem">Classes</li>
                            <button type="button" onClick={contactHandler} className="btn flex btnOne">
                                Contact
                            </button>
                        </ul>
                    </div>

                    <button type="button" onClick={() => setMenuOpen(true)} className="toggleIcon" aria-label="Open menu">
                        <HiMenu className="icon" />
                    </button>
                </div>

                <div className="atb flex">
                    {isAuthenticated ? (
                        <AvatarUser />
                    ) : (
                        <>
                            <Link to="/register">
                                <span>Sign Up</span>
                            </Link>
                            <Link to="/login">
                                <span>Sign In</span>
                            </Link>
                        </>
                    )}
                </div>
            </div>

            <ContactModal isOpen={isContactOpen} onOpenChange={onContactOpenChange} />
        </div>
    );
};

export default Navbar;
