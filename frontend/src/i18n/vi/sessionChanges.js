// Vietnamese: session changes — calling a class session off with a reason the class sees, moving it to another
// day in one step (the make-up says which day it replaces), closing the studio for a day; the students' and
// teachers' schedule (week strip, agenda, next session), the class notice, the bell's "Lịch thay đổi" group
// and the activity log. Staff: short and plain. Students and teachers: friendly, "bạn".
// Words: called off → nghỉ (the class is told "nghỉ", not "huỷ") · make-up → học bù · shoot day here → buổi quay.
export default {
    // Ready-made reasons (services/sessionChanges.js CHANGE_REASONS; stored in English, shown translated)
    'Storm / bad weather': 'Bão / thời tiết xấu',
    'Teacher is ill': 'Giáo viên ốm',
    'Problem with the room': 'Phòng có sự cố',
    'Public holiday': 'Nghỉ lễ',

    // Staff: the session dialog and today's board
    'Call off / move': 'Nghỉ / dời buổi',
    'Call off or move the session of {name}': 'Nghỉ hoặc dời buổi học của lớp {name}',
    'Called off: {reason}': 'Lý do nghỉ: {reason}',
    'Made up on {day}, {time}': 'Đã xếp học bù {day}, {time}',
    'This session was cancelled. The make-up counts for the routine in its place.': 'Buổi này đã nghỉ. Buổi học bù được tính vào bài nhảy thay cho buổi này.',
    'Make-up for {day}': 'Học bù cho {day}',
    'Make-up · {day}': 'Học bù {day}',

    // Staff: call off / move
    'Call off or move the session': 'Nghỉ / dời buổi',
    'Schedule the make-up': 'Xếp học bù',
    'What happens to the session?': 'Buổi này xử lý thế nào?',
    'Make it up on another day': 'Học bù vào ngày khác',
    'Call it off and add the make-up now': 'Nghỉ buổi này và xếp luôn buổi bù',
    'Only call it off': 'Chỉ nghỉ, xếp học bù sau',
    'Schedule the make-up later': 'Báo nghỉ trước, buổi bù xếp sau',
    'The class sees it in their schedule.': 'Học viên và giáo viên sẽ thấy lý do này trong lịch học.',
    'Ready-made reasons': 'Lý do có sẵn',
    'The make-up': 'Buổi học bù',
    'Finding a free day…': 'Đang tìm ngày trống…',
    'The {day} session is called off. Pick the make-up’s day and time: the class sees both.':
        'Buổi {day} đã nghỉ. Chọn ngày giờ học bù, cả lớp sẽ thấy lịch nghỉ và lịch bù.',
    'Move the session': 'Dời buổi',
    'Add the make-up': 'Xếp học bù',
    'Call off the session': 'Nghỉ buổi này',
    'Moved to {day}, {time}.': 'Đã dời sang {day}, {time}.',
    'Make-up added on {day}, {time}.': 'Đã xếp học bù {day}, {time}.',
    'Session called off.': 'Đã báo nghỉ buổi này.',
    'This session has already started, so it can’t be called off.': 'Buổi này đã bắt đầu nên không thể cho nghỉ.',
    'The class doesn’t meet that day.': 'Lớp không có lịch học ngày đó.',
    'Pick another day for the make-up.': 'Chọn một ngày khác để học bù.',
    'Say why the session is called off.': 'Cần ghi lý do nghỉ.',

    // What happens to the shoot day
    'This is the shoot day of “{title}”. The make-up becomes the shoot day.': 'Đây là buổi quay của “{title}”. Buổi học bù sẽ thành buổi quay.',
    'This is the shoot day of “{title}”. The shoot day moves to the next session.': 'Đây là buổi quay của “{title}”. Buổi quay sẽ lùi sang buổi sau.',
    'This is the shoot day of “{title}”. The shoot day moves to {day}.': 'Đây là buổi quay của “{title}”. Buổi quay sẽ chuyển sang {day}.',
    'This is the shoot day of “{title}”. The shoot day moves to the next session, {day}.':
        'Đây là buổi quay của “{title}”. Buổi quay sẽ lùi sang buổi sau ({day}).',
    'This is the shoot day of “{title}”. The class ends before another session, so check the routine.':
        'Đây là buổi quay của “{title}”. Lớp kết thúc trước buổi tiếp theo, cần xem lại bài nhảy.',
    'The make-up becomes the shoot day of “{title}”.': 'Buổi học bù sẽ thành buổi quay của “{title}”.',
    'The shoot day of “{title}” moves to {day}.': 'Buổi quay của “{title}” sẽ chuyển sang {day}.',

    // Staff: close the studio for a day
    'Close for a day': 'Nghỉ cả ngày',
    'Close the studio for a day': 'Cho studio nghỉ cả ngày',
    'Every class that day is called off, and the class sees why.': 'Mọi lớp hôm đó đều nghỉ, học viên sẽ thấy lý do.',
    'What closing the day touches': 'Những gì bị ảnh hưởng',
    'What closing {day} touches': 'Ảnh hưởng khi nghỉ {day}',
    '{count} class is called off': '{count} lớp sẽ nghỉ',
    '{count} classes are called off': '{count} lớp sẽ nghỉ',
    'No class to call off': 'Không có lớp nào phải nghỉ',
    'Already called off': 'Đã nghỉ từ trước',
    'Already started': 'Đã bắt đầu',
    '{count} room booking that day': '{count} lượt đặt phòng hôm đó',
    '{count} room bookings that day': '{count} lượt đặt phòng hôm đó',
    'No room booking that day': 'Không có lượt đặt phòng nào hôm đó',
    '{amount} paid': 'đã trả {amount}',
    'Nothing paid': 'chưa trả tiền',
    'Also cancel that day’s room bookings (full refund)': 'Huỷ luôn các lượt đặt phòng hôm đó (hoàn toàn bộ tiền)',
    'Goes back to the guests:': 'Hoàn lại cho khách:',
    'Close on {day}': 'Nghỉ {day}',
    'The studio is closed on {day}.': 'Đã cho studio nghỉ {day}.',
    'Closed on {day}': 'Đã nghỉ {day}',
    '{count} session called off': 'Nghỉ {count} buổi học',
    '{count} sessions called off': 'Nghỉ {count} buổi học',
    '{count} booking cancelled': 'Huỷ {count} lượt đặt phòng',
    '{count} bookings cancelled': 'Huỷ {count} lượt đặt phòng',
    'Make-ups': 'Học bù',
    'Schedule the make-ups': 'Xếp học bù',
    'Each class can make the session up on another day.': 'Mỗi lớp có thể học bù vào một ngày khác.',
    'Schedule the make-up for {name}': 'Xếp học bù cho lớp {name}',
    'Make-up {day}, {time}': 'Học bù {day}, {time}',
    'No class met that day.': 'Hôm đó không có lớp nào.',
    'Refunds of the cancelled bookings are on the Bookings page': 'Tiền hoàn của các lượt đặt đã huỷ nằm ở trang Đặt phòng',

    // Students and teachers: their schedule and the class notice
    'Schedule changes': 'Lịch thay đổi',
    'In the next 7 days': 'Trong 7 ngày tới',
    'Called off': 'Nghỉ',
    '{cls} is off on {day}': '{cls} nghỉ {day}',
    'Off on {day}': 'Nghỉ {day}',
    'Called off by the studio': 'Studio báo nghỉ',
    '{cls}: make-up {day}, {time}': '{cls}: học bù {day}, {time}',
    '{cls}: make-up {day}': '{cls}: học bù {day}',
    'Make-up {day}': 'Học bù {day}',
    'Instead of {day}': 'Thay buổi {day}',
    'An extra session': 'Buổi học thêm',

    // The bell (/profile)
    'Notifications: {count} schedule change': 'Thông báo: {count} thay đổi lịch học',
    'Notifications: {count} schedule changes': 'Thông báo: {count} thay đổi lịch học',
    'Notifications: {pay} to pay or answer, {count} schedule change': 'Thông báo: {pay} việc cần đóng tiền hoặc trả lời, {count} thay đổi lịch học',
    'Notifications: {pay} to pay or answer, {count} schedule changes': 'Thông báo: {pay} việc cần đóng tiền hoặc trả lời, {count} thay đổi lịch học',
    'Notifications: nothing new': 'Thông báo: chưa có gì mới',
    '{count} schedule change': '{count} thay đổi lịch học',
    '{count} schedule changes': '{count} thay đổi lịch học',
    'Nothing new right now': 'Hiện chưa có gì mới',
    'Payments and changes to your class schedule will show up here.': 'Khoản cần đóng và thay đổi lịch học của bạn sẽ hiện ở đây.',

    // Activity log
    'Studio closed for a day': 'Nghỉ cả ngày',
    '{actor} closed the studio on {date}': '{actor} cho studio nghỉ {date}',
};
