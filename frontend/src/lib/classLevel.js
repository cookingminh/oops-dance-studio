// A class's level (classes.level): what the poster timetable colours each class by, keyed under the grid —
// the colours of the studio's printed schedule. Labels are English i18n keys.

export const LEVELS = [
    { value: 'newbie', label: 'Newbie', legend: 'Newbie classes', color: '#c4321f', ink: '#fff' },
    { value: 'basic', label: 'Basic', legend: 'Basic classes', color: '#b5795c', ink: '#fff' },
    { value: 'advanced', label: 'Advanced', legend: 'Advanced classes', color: '#f2bf2f', ink: '#fff' },
];

// A class without a level: a neutral warm grey.
export const NO_LEVEL = { value: null, label: 'No level', legend: null, color: '#6f6660', ink: '#fff' };

export const levelOf = (value) => LEVELS.find((level) => level.value === value) ?? NO_LEVEL;
