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
    { key: 'other', label: 'Other', hint: 'Anything else.' },
];

export const categoryOf = (key) => EXPENSE_CATEGORIES.find((category) => category.key === key) ?? EXPENSE_CATEGORIES.at(-1);
