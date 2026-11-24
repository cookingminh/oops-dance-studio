// Join requests, the staff side: the Join requests page, the class hub's waiting list, approve and
// decline (services/classJoinStaff.js).
export default {
    // The page (sidebar, top bar, card)
    'Join requests': 'Đăng ký vào lớp',
    'Students asking to join a class: approve or decline.': 'Học viên xin vào lớp: duyệt hoặc từ chối.',
    'Requests': 'Yêu cầu',
    '{count} request waiting for an answer': '{count} yêu cầu đang chờ trả lời',
    '{count} requests waiting for an answer': '{count} yêu cầu đang chờ trả lời',
    'the oldest asked {time}': 'yêu cầu cũ nhất gửi {time}',
    'Nobody is waiting for an answer': 'Không có ai đang chờ trả lời',
    'Answered in the last 30 days': 'Đã trả lời trong 30 ngày qua',
    'No one is waiting.': 'Không có ai đang chờ.',
    'New requests show up here and in the bell.': 'Yêu cầu mới sẽ hiện ở đây và ở chuông thông báo.',
    'Nothing answered in the last 30 days.': '30 ngày qua chưa trả lời yêu cầu nào.',
    'Approved, declined and cancelled requests stay here for 30 days.': 'Yêu cầu đã duyệt, đã từ chối hay đã huỷ được giữ ở đây 30 ngày.',
    'Show every class': 'Xem tất cả các lớp',

    // One request
    'New to the studio': 'Học viên mới',
    'Also in {classes}': 'Đang học {classes}',
    'Took {classes} before': 'Từng học {classes}',
    'Wants to start now': 'Muốn vào học ngay',
    'Wants to start from the next course': 'Muốn học từ khoá sau',
    'Asked just now': 'Vừa gửi',
    'Asked {time}': 'Gửi {time}',
    'Asked {date}': 'Gửi {date}',
    '{count} min ago': '{count} phút trước',
    '{count} hour ago': '{count} giờ trước',
    '{count} hours ago': '{count} giờ trước',
    '{count} day ago': '{count} ngày trước',
    '{count} days ago': '{count} ngày trước',
    'Waiting {count} day': 'Đã chờ {count} ngày',
    'Waiting {count} days': 'Đã chờ {count} ngày',
    'Approve {name}': 'Duyệt {name}',
    'Decline {name}': 'Từ chối {name}',
    'Decline': 'Từ chối',
    'Declined': 'Đã từ chối',
    'Cancelled by the student': 'Học viên đã tự huỷ',
    'Answered by {name} · {date}': '{name} đã trả lời · {date}',
    'In the class from {date}': 'Vào lớp từ {date}',
    'Reason:': 'Lý do:',

    // Approve
    'Approve the request': 'Duyệt yêu cầu',
    'Add {name} to {class}': 'Thêm {name} vào lớp {class}',
    'Checking the class’s courses…': 'Đang xem các khoá của lớp…',
    'They asked for this': 'Học viên chọn',
    'They asked to start from the next course, which isn’t planned yet. Approve to start them now, or plan the next routine first.':
        'Học viên muốn học từ khoá sau, nhưng lớp chưa lên bài cho khoá sau. Duyệt bây giờ thì học viên vào học ngay; hoặc lên bài nhảy tiếp theo trước rồi duyệt.',
    '{name} is in {class}. Their invoice is ready in Tuition.': '{name} đã vào lớp {class}. Hoá đơn đã có trong mục Học phí.',
    '{name} joins {class} on {date}. Their invoice is ready in Tuition.': '{name} sẽ vào lớp {class} từ {date}. Hoá đơn đã có trong mục Học phí.',
    '{name} is in {class}. Their invoices are ready in Tuition.': '{name} đã vào lớp {class}. Các hoá đơn đã có trong mục Học phí.',
    '{name} is in {class}.': '{name} đã vào lớp {class}.',
    '“{title}”: pays for the {count} sessions left, and for the next course “{next}”, whose invoices are already out.':
        '“{title}”: đóng học phí {count} buổi còn lại, kèm khoá sau “{next}” vì hoá đơn khoá sau đã gửi rồi.',

    // Joining a running course without pro-rata (the default; Tuition → Settings turns it on): the whole course.
    // Also "Add a student" (class hub), the class's Tuition tab and the routine form.
    '“{title}”: pays the full course ({left} of {count} sessions left).': '“{title}”: đóng trọn khoá (còn {left}/{count} buổi).',
    '“{title}”: pays the full course ({left} of {count} sessions left), and the next course “{next}”, whose invoices are already out.':
        '“{title}”: đóng trọn khoá (còn {left}/{count} buổi), kèm khoá sau “{next}” vì hoá đơn khoá sau đã gửi rồi.',
    'They join “{title}” now and pay the full course ({left} of {count} sessions left).':
        'Học viên vào học “{title}” ngay, đóng trọn khoá (còn {left}/{count} buổi).',
    'One invoice per student and course.': 'Mỗi học viên một khoản học phí cho mỗi khoá.',
    'One invoice per student and course. Joining late pays the full course.':
        'Mỗi học viên một khoản học phí cho mỗi khoá. Vào giữa khoá vẫn đóng trọn khoá.',
    'Students pay this per course, in full even when they join late.': 'Học viên đóng mức này cho mỗi khoá, vào giữa khoá cũng đóng đủ.',

    // Decline
    'Decline the request': 'Từ chối yêu cầu',
    '{name} for {class}': '{name} · lớp {class}',
    'Why? (optional)': 'Lý do (không bắt buộc)',
    'The class is full': 'Lớp đã đủ người',
    'This level may not suit you yet. Try a newbie class': 'Trình độ lớp này có thể chưa hợp với bạn. Bạn thử lớp Newbie trước nhé',
    'The time slot changed': 'Lớp đã đổi giờ học',
    'Or write a few words of your own': 'Hoặc tự viết vài dòng',
    'The student will see this reason.': 'Học viên sẽ thấy lý do này.',
    '{name} won’t join {class}. They’ll see your answer in My classes.': 'Đã từ chối {name} vào lớp {class}. Học viên sẽ thấy câu trả lời trong mục Lớp của tôi.',

    // The class page's Students tab
    'Waiting to join': 'Đang chờ vào lớp',
    'Waiting to join ({count})': 'Đang chờ vào lớp ({count})',
    'They asked on the website. Approve to add them to the class: they are billed as usual.':
        'Học viên xin vào lớp trên website. Duyệt để thêm vào lớp, học phí tính như bình thường.',
    'All join requests': 'Tất cả yêu cầu',

    // The bell
    '{name} asked to join {cls}': '{name} xin vào lớp {cls}',
    '{name} asked to join {count} classes': '{name} xin vào {count} lớp',
    '{count} student asked to join a class': '{count} học viên xin vào lớp',
    '{count} students asked to join a class': '{count} học viên xin vào lớp',
    'The oldest has waited {count} day': 'Yêu cầu cũ nhất đã chờ {count} ngày',
    'The oldest has waited {count} days': 'Yêu cầu cũ nhất đã chờ {count} ngày',
    'Asked {count} hour ago': 'Gửi {count} giờ trước',
    'Asked {count} hours ago': 'Gửi {count} giờ trước',
    '{classes} and {count} other classes': '{classes} và {count} lớp khác',

    // The Activity page
    'a class': 'một lớp',
    '{actor} asked to join {class}': '{actor} xin vào lớp {class}',
    '{name} cancelled their request to join {class}': '{name} huỷ yêu cầu vào lớp {class}',
    '{actor} cancelled {name}’s request to join {class}': '{actor} huỷ yêu cầu vào lớp {class} của {name}',
    '{actor} approved {name} for {class}': '{actor} duyệt cho {name} vào lớp {class}',
    '{name}’s request to join {class} was approved': 'Yêu cầu vào lớp {class} của {name} đã được duyệt',
    '{actor} declined {name} for {class}': '{actor} từ chối {name} vào lớp {class}',
    '{name}’s request to join {class} was declined': 'Yêu cầu vào lớp {class} của {name} đã bị từ chối',
    '{actor} approved {count} students for {class}': '{actor} duyệt {count} học viên vào lớp {class}',
    '{actor} declined {count} students for {class}': '{actor} từ chối {count} học viên vào lớp {class}',
    '{count} requests to join {class} were declined': '{count} yêu cầu vào lớp {class} đã bị từ chối',
    'Asked to join': 'Xin vào lớp',
    'Request cancelled': 'Đã huỷ yêu cầu',
    'Request approved': 'Đã duyệt yêu cầu',
    'Request declined': 'Đã từ chối yêu cầu',

    // Approving into a class with a maximum number of students.
    'The class is full ({taken} of {max} places). Raise its maximum to approve.': 'Lớp đã đủ ({taken}/{max} chỗ). Tăng sĩ số tối đa để duyệt.',
    'Open its setup': 'Mở tab Setting của lớp',
    '{left} of {max} places left before approving.': 'Trước khi duyệt còn {left}/{max} chỗ.',
    'Full · {taken}/{max}': 'Đã đủ · {taken}/{max}',
};
