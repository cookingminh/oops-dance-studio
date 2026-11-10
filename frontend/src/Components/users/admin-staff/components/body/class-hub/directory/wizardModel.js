// Checks for the "New class" wizard's forms.

// Problems with the details step ({ name, instructorId, price, startsOn }); `today` is 'yyyy-MM-dd'.
export function detailProblems(form, today) {
    const price = Number(form.price);
    return {
        name: !form.name.trim(),
        instructor: !form.instructorId,
        price: form.price === '' || Number.isNaN(price) || price < 0,
        startsOn: !form.startsOn || (today && form.startsOn < today),
    };
}

// A routine needs a title and 1–60 sessions; the fee is optional (empty = the class price).
export function routineValid(routine) {
    const count = Number(routine.sessions);
    return Boolean(routine.title.trim()) && Number.isInteger(count) && count >= 1 && count <= 60 && (routine.price === '' || Number(routine.price) >= 0);
}
