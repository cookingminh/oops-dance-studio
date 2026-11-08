import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight } from 'react-icons/lu';
import { fadeUp } from './motion';

// The white card every admin page is built from: a header (icon, title, subtitle, actions),
// its content and an optional footer. It fades up when the page (or the data it waits for) appears.
const SectionCard = ({ title, subtitle, actions, icon: Icon, footer, className = '', children, ...rest }) => (
    <motion.section variants={fadeUp} className={`sectionContainer adminCard ${className}`} {...rest}>
        {(title || actions) && (
            <header className="cardHeader">
                {Icon && (
                    <span className="cardIcon" aria-hidden="true">
                        <Icon />
                    </span>
                )}
                <div className="cardTitles">
                    {title && <h2>{title}</h2>}
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="cardActions">{actions}</div>}
            </header>
        )}
        <div className="cardBody">{children}</div>
        {footer && <footer className="cardFooter">{footer}</footer>}
    </motion.section>
);

// Footer link that takes the reader to the page with the full details.
export const CardFooterLink = ({ to, children }) => (
    <Link to={to} className="footerLink">
        <span>{children}</span>
        <LuArrowRight aria-hidden="true" />
    </Link>
);

export default SectionCard;
