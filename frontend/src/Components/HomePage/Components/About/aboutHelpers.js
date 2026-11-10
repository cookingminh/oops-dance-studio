// Shared bits for the About us components (kept out of the .jsx files for react-refresh).

export const EASE_OUT = [0.22, 1, 0.36, 1];
const VIEWPORT = { once: true, margin: '0px 0px -12% 0px' };

// Spread on a motion element: fades up once when it scrolls into view.
export const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: VIEWPORT,
    transition: { duration: 0.45, ease: EASE_OUT },
};

// A container whose `revealItem` children come in one after another.
export const revealGroup = {
    initial: 'hidden',
    whileInView: 'show',
    viewport: VIEWPORT,
    variants: { hidden: {}, show: { transition: { staggerChildren: 0.08 } } },
};

export const revealItem = {
    variants: {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
    },
};

// Dance styles recognised in class names, so a crew card says "K-pop cover" once instead of
// listing every level of the same class. Labels are i18n keys.
const STYLES = [
    { pattern: /k-?pop/i, label: 'K-pop cover' },
    { pattern: /hip-?hop/i, label: 'Hip-hop' },
    { pattern: /break/i, label: 'Breaking' },
    { pattern: /contemporary|jazz/i, label: 'Contemporary & jazz' },
    { pattern: /choreo/i, label: 'Choreography' },
];

// The instructors (all Oops! Crew members) from the public class list, once each, with the
// styles they teach (`isKey` marks a translatable style label; otherwise it is a class name).
export function crewFromClasses(classes) {
    const byName = new Map();
    for (const item of classes) {
        if (!item.instructor_name) continue;
        const entry = byName.get(item.instructor_name) ?? {
            name: item.instructor_name,
            avatarPath: item.instructor_avatar_path,
            styles: new Map(),
            sessions: 0,
        };
        entry.avatarPath ??= item.instructor_avatar_path;
        const style = STYLES.find(({ pattern }) => pattern.test(item.name));
        const label = style?.label ?? item.name;
        entry.styles.set(label, { label, isKey: Boolean(style) });
        entry.sessions += (item.schedules ?? []).length;
        byName.set(item.instructor_name, entry);
    }
    return [...byName.values()]
        .map((entry) => ({ ...entry, styles: [...entry.styles.values()] }))
        .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}
