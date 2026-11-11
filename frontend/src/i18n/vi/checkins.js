// Vietnamese: instructor check-ins — the check-in window (opens 15 minutes before a session, closes at its end),
// a late check-out (more than 10 minutes after the end), staff correcting the times with a reason, and its
// line in the activity log. Instructors: friendly and short. Staff: plain.
// Words: check-in / check-out stay as they are · late check-out → check-out muộn.
export default {
    // Instructor: the check-in / check-out button
    'Check-in opens at {time}': 'Mở check-in lúc {time}',
    'The session is over — ask the studio to record it': 'Buổi đã kết thúc — báo studio ghi nhận',
    'Check out late': 'Check-out muộn',
    'The class ended at {end}; a check-out now is marked late.': 'Lớp đã kết thúc lúc {end}, check-out bây giờ sẽ tính là muộn.',

    // The badge (staff pages, the instructor's history)
    'Late check-out': 'Check-out muộn',
    'More than 10 minutes after the end ({end}).': 'Quá 10 phút sau giờ kết thúc ({end}).',
    'More than 10 minutes after the end.': 'Quá 10 phút sau giờ kết thúc.',

    // Staff: correcting the times
    'Edit check-in/out times': 'Sửa giờ check-in/out',
    'Forgot to check out': 'Quên check-out',
    'Forgot to check in': 'Quên check-in',
    'Wrong time': 'Nhầm giờ',
    'Kept back by the studio': 'Studio giữ lại',
    Auto: 'Tự động',
    'Mark late': 'Muộn',
    'Not late': 'Không muộn',
    'No check-out yet: the session stays open.': 'Chưa check-out: buổi vẫn đang mở.',
    'Late: more than 10 minutes after the end ({end}).': 'Muộn: quá 10 phút sau giờ kết thúc ({end}).',
    'On time: within 10 minutes of the end ({end}).': 'Đúng giờ: trong vòng 10 phút sau giờ kết thúc ({end}).',
    'The session ends at {end}.': 'Buổi kết thúc lúc {end}.',
    'Kept in the activity log.': 'Lưu lại trong mục Hoạt động.',
    'Save the times': 'Lưu giờ',
    'Check-in times corrected.': 'Đã sửa giờ check-in/out.',
    'Enter the check-in time.': 'Nhập giờ check-in.',
    'The check-out comes after the check-in.': 'Giờ check-out phải sau giờ check-in.',
    'Say why the times change.': 'Ghi lý do sửa giờ.',

    // Activity log
    'Check-in times corrected': 'Sửa giờ check-in/out',
    '{actor} corrected {name}’s check-in times for {class}': '{actor} đã sửa giờ check-in/out của {name} ở lớp {class}',
    // Server refusals (services/errors.js)
    'The check-out time must be after the check-in time.': 'Giờ check-out phải sau giờ check-in.',
    'Please give a reason.': 'Vui lòng ghi lý do.',
};
