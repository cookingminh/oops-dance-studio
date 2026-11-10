// Links into the Activity page from elsewhere (a person's sheet, a class page). They open the
// last `days` days, since a 7-day week is often too short for one person or class.
//   activityPath({ person })   what someone did
//   activityPath({ subject })  what happened to a guest or student
//   activityPath({ classId })  everything about one class
export function activityPath({ person, subject, classId, days = 30 } = {}) {
    const params = new URLSearchParams();
    if (person) params.set('person', person);
    if (subject) params.set('subject', subject);
    if (classId) params.set('class', String(classId));
    if (days) params.set('days', String(days));
    return `/admin/activity?${params}`;
}
