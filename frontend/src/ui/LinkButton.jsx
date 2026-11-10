import { Link } from 'react-router-dom';

// A router link that looks like a NextUI button. (NextUI's <Button as={Link}> gets role="button",
// which hides that it navigates.)
const BASE = 'inline-flex items-center justify-center gap-2 rounded-medium font-medium whitespace-nowrap transition-opacity transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus';
const SIZES = { sm: 'h-8 px-3 text-tiny', md: 'h-10 px-4 text-small' };
const VARIANTS = {
    solid: 'bg-danger text-danger-foreground hover:opacity-90',
    flat: 'bg-default/40 text-default-foreground hover:bg-default/60',
    light: 'text-default-foreground hover:bg-default/40',
};

const LinkButton = ({ to, variant = 'solid', size = 'md', startContent, className = '', children, ...rest }) => (
    <Link to={to} className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`} {...rest}>
        {startContent}
        {children}
    </Link>
);

export default LinkButton;
