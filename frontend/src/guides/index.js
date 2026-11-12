import activity from './activity';
import bookings from './bookings';
import charts from './charts';
import dashboard from './dashboard';

// Page guides: the (?) in the top bar (ui/guide/PageGuideButton) opens the guide of the page shown.
// Page path, as in the menus ('/admin/charts') → { id, build(i18n, { role }) → { id, title, intro, sections,
// outro } }; see ui/guide/GuideModal for the shape. A page whose guide differs by role builds it from `role`.
const GUIDES = {
    '/admin': dashboard,
    '/admin/activity': activity,
    '/admin/bookings': bookings,
    '/admin/charts': charts,
};

export function guideFor(path) {
    return GUIDES[path] ?? null;
}
