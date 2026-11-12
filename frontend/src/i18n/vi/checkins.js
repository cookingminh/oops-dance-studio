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

    // Staff: correcting the times from the session modal's tiles (CheckEditor.jsx)
    'Forgot to check out': 'Quên check-out',
    'Forgot to check in': 'Quên check-in',
    'Wrong time': 'Nhầm giờ',
    'Kept back by the studio': 'Studio giữ lại',
    'Tap a time to correct it.': 'Bấm vào giờ để sửa.',
    'Correct the check-in': 'Sửa giờ check-in',
    'Correct the check-out': 'Sửa giờ check-out',
    'Set the check-in': 'Ghi giờ check-in',
    'Set the check-out': 'Ghi giờ check-out',
    'Quick times': 'Chọn nhanh giờ',
    'Start {time}': 'Bắt đầu {time}',
    'End {time}': 'Kết thúc {time}',
    'Counts as a late check-out': 'Tính là check-out muộn',
    'Within 10 minutes of the end ({end}).': 'Trong vòng 10 phút sau giờ kết thúc ({end}).',
    Why: 'Lý do',
    'Other…': 'Khác…',
    'Say why, in a few words': 'Ghi ngắn lý do',
    'Remove the check-out': 'Xoá giờ check-out',
    'Check-in times corrected.': 'Đã sửa giờ check-in/out.',
    'Enter the check-in time.': 'Nhập giờ check-in.',
    'Enter the check-in time, like 18:15.': 'Nhập giờ check-in, ví dụ 18:15.',
    'Enter the check-out time, like 19:30.': 'Nhập giờ check-out, ví dụ 19:30.',
    'The check-out comes after the check-in.': 'Giờ check-out phải sau giờ check-in.',
    'Say why the times change.': 'Ghi lý do sửa giờ.',

    // Activity log
    'Check-in times corrected': 'Sửa giờ check-in/out',
    '{actor} corrected {name}’s check-in times for {class}': '{actor} đã sửa giờ check-in/out của {name} ở lớp {class}',
    // Server refusals (services/errors.js)
    'The check-out time must be after the check-in time.': 'Giờ check-out phải sau giờ check-in.',
    'Please give a reason.': 'Vui lòng ghi lý do.',
};
