// Why a join request can't go through: messages from services/errors.js for class_join_* RPCs.
export default {
    // The student asking (class_join_request / class_join_cancel)
    'You’re already in this class.': 'Bạn đang học lớp này rồi.',
    'You’ve already asked to join this class. The studio will get back to you soon.':
        'Bạn đã xin vào lớp này rồi. Studio sẽ sớm phản hồi bạn nhé.',
    'You have 3 requests waiting already. Wait for an answer, or cancel one, before asking again.':
        'Bạn đang có 3 yêu cầu chờ duyệt. Chờ studio trả lời, hoặc huỷ bớt một yêu cầu rồi xin tiếp nhé.',
    'This class isn’t taking new students.': 'Lớp này không nhận thêm học viên mới.',
    'Only student accounts can ask to join a class.': 'Chỉ tài khoản học viên mới xin vào lớp được.',
    'The note is up to 500 characters.': 'Lời nhắn tối đa 500 ký tự.',

    // Staff answering (class_join_approve / class_join_decline)
    'This request has already been answered or cancelled. Refresh to see it.':
        'Yêu cầu này đã được trả lời hoặc đã huỷ. Tải lại trang để xem.',
    'This class has no next course planned yet. Start them now, or plan the next routine first.':
        'Lớp chưa lên bài cho khoá sau. Cho học viên vào học từ bây giờ, hoặc lên bài nhảy tiếp theo trước.',
    'The reason is up to 300 characters.': 'Lý do tối đa 300 ký tự.',

    // The reason the database gives when the class ends (class_join_requests.decline_reason)
    'The class has ended.': 'Lớp đã kết thúc.',

    // A class at its maximum number of students.
    'This class is full.': 'Lớp này đã đủ học viên.',
    'This class is full. Raise its maximum number of students to add more.': 'Lớp này đã đủ học viên. Tăng sĩ số tối đa để thêm người.',
    'More students already hold a place in this class than that maximum.': 'Số học viên đang có trong lớp nhiều hơn sĩ số tối đa này.',
};
