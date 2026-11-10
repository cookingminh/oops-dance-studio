import { Link } from 'react-router-dom';
import { classPath } from './hubModel';
import './classHub.scss';

// A class name elsewhere in the admin (dashboard, tuition, students, attendance, reports) that opens
// the class's page. Without an id it stays plain text.
const ClassLink = ({ id, children, className = '' }) =>
    id ? (
        <Link to={classPath(id)} className={`hubClassLink ${className}`}>
            {children}
        </Link>
    ) : (
        children
    );

export default ClassLink;
