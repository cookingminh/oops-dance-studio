// Expense categories (the database accepts exactly these keys; see private.is_expense_category).
// Labels are English source text for t(); `hint` says what belongs there.
export const EXPENSE_CATEGORIES = [
    { key: 'rent', label: 'Rent', hint: 'The studio space, monthly.' },
    { key: 'utilities', label: 'Utilities', hint: 'Electricity, water, internet.' },
    { key: 'video', label: 'Video shoot', hint: 'Camera crew and editing for the monthly class videos.' },
    { key: 'costumes', label: 'Costumes', hint: 'Renting or buying outfits for a shoot or show.' },
    { key: 'shoot_location', label: 'Shoot location', hint: 'A studio or venue hired for a shoot.' },
    { key: 'equipment', label: 'Equipment', hint: 'Speakers, mirrors, lights, cameras.' },
    { key: 'marketing', label: 'Marketing', hint: 'Ads, printing, promotions.' },
    { key: 'events', label: 'Events', hint: 'Showcases, performances, workshops.' },
    { key: 'maintenance', label: 'Maintenance', hint: 'Repairs and cleaning.' },
    { key: 'supplies', label: 'Supplies', hint: 'Drinks, tissues, office bits.' },
    // Added by itself after each session at a rented studio (services/venues.js); staff can add one too.
    { key: 'venue_rent', label: 'Studio rent', hint: 'A rented studio’s hourly rent for a class session. Added by itself after each session there.' },
    { key: 'other', label: 'Other', hint: 'Anything else.' },
];

export const categoryOf = (key) => EXPENSE_CATEGORIES.find((category) => category.key === key) ?? EXPENSE_CATEGORIES.at(-1);

// Automatic studio rent (supabase/migrations/20261117001300_venues.sql): once a session at a rented studio has
// ended, the server adds its rent as an expense of the class (session_id set, created_by null) and removes it
// if the session is called off. Its description is written by the server in English.
export const isAutomaticRent = (expense) => Boolean(expense?.session_id) && expense.category === 'venue_rent';

const RENT_TEXT = /^Studio rent: (.+), (\d{2}:\d{2}–\d{2}:\d{2})$/;

// What to call an expense (a row, or an Activity entry's { category, vendor, description }): the automatic
// rent's server text ("Studio rent: {class}, 18:00–19:30") read in the user's language, else as written.
export function expenseTitle(expense, t) {
    const match = expense?.category === 'venue_rent' ? RENT_TEXT.exec(expense.description ?? '') : null;
    if (!match) return expense?.description;
    const vars = { vendor: expense.vendor, class: match[1], time: match[2] };
    return expense.vendor ? t('Rent at {vendor}: {class}, {time}', vars) : t('Studio rent: {class}, {time}', vars);
}
