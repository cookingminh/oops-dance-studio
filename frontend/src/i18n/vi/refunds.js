// Vietnamese: booking cancellations and refunds — the cancellation policy (everyone), the guest's cancel
// dialog and refund lines in My bookings, the staff cancel dialog, the refund block, the policy editor, the
// to-do and the activity log. Guests: friendly, "bạn"; staff: short and plain.
export default {
    // The policy (services/bookingRefunds.js refundPolicyLines) and the step a cancellation falls in
    'Cancellation policy': 'Chính sách huỷ',
    'Cancel {hours} hours or more ahead: full refund': 'Huỷ trước {hours} giờ: hoàn toàn bộ',
    'Cancel {hours} hours or more ahead: {percent}% back': 'Huỷ trước {hours} giờ: hoàn {percent}%',
    'Less than {hours} hours ahead: no refund': 'Huỷ khi còn dưới {hours} giờ: không hoàn tiền',
    'Not approved yet, or cancelled by the studio: full refund': 'Lượt chưa duyệt, hoặc do studio huỷ: hoàn toàn bộ',
    'Not approved yet: full refund': 'Lượt chưa duyệt: hoàn toàn bộ',
    'Cancelled by the studio: full refund': 'Studio huỷ: hoàn toàn bộ',
    'Applies now': 'Đang áp dụng',

    // Guest: cancel dialog (My bookings)
    'Cancel this booking?': 'Huỷ lượt đặt phòng này?',
    'You get {amount} back': 'Bạn được hoàn {amount}',
    '(you paid {amount})': '(đã đóng {amount})',
    'You haven’t paid anything, so there’s nothing to refund.': 'Bạn chưa đóng tiền nên không có gì cần hoàn.',
    'Less than {hours} hours to go, so there’s no refund.': 'Còn chưa đầy {hours} giờ nên không được hoàn tiền.',
    'Working out your refund…': 'Đang tính tiền hoàn cho bạn…',
    'The refund couldn’t be worked out right now. It still follows the policy below.': 'Chưa tính được tiền hoàn lúc này. Tiền hoàn vẫn theo chính sách bên dưới.',
    'Send the refund to': 'Nhận tiền hoàn vào tài khoản',
    'Bank, account number, account name': 'Ngân hàng, số tài khoản, tên chủ tài khoản',
    'Optional. Leave it empty and the studio will contact you.': 'Không bắt buộc. Để trống thì studio sẽ liên hệ bạn.',
    'Keep the booking': 'Giữ lượt đặt',
    'Cancel the booking': 'Huỷ lượt đặt',
    // Guest: the refund on a cancelled booking
    'The studio will refund {amount}': 'Studio sẽ hoàn {amount}',
    'The studio will refund {amount} to {account}': 'Studio sẽ hoàn {amount} vào {account}',
    'Refunded {amount}': 'Đã hoàn {amount}',

    // Staff: cancel dialog
    'Cancel booking #{id}': 'Huỷ lượt đặt phòng #{id}',
    'Who asked to cancel?': 'Ai yêu cầu huỷ?',
    'Guest asked': 'Khách xin huỷ',
    'By the policy': 'Theo chính sách',
    'Studio cancels': 'Studio huỷ',
    'Full refund': 'Hoàn toàn bộ',
    'Working out the refund…': 'Đang tính tiền hoàn…',
    'Nothing was paid, so there’s nothing to refund.': 'Khách chưa trả tiền nên không cần hoàn.',
    'Studio keeps': 'Studio giữ lại',
    'Refund (VND)': 'Số tiền hoàn (VND)',
    'As the policy says.': 'Đúng theo chính sách.',
    'The policy gives {amount}.': 'Theo chính sách: {amount}.',
    'Back to {amount}': 'Về lại {amount}',
    'Needed because the amount differs from the policy.': 'Bắt buộc vì số tiền khác chính sách.',
    'Enter an amount between 0 and {amount}.': 'Nhập số tiền từ 0 đến {amount}.',
    'Moved to another booking': 'Chuyển sang lượt đặt khác',
    'Regular customer': 'Khách quen',
    'Problem on the studio’s side': 'Lỗi từ phía studio',

    // Staff: the refund block (booking dialog) and changing a refund
    'Cancelled by the guest': 'Khách huỷ',
    'Cancelled by the studio': 'Studio huỷ',
    'Rejected by the studio': 'Studio từ chối',
    'To refund': 'Cần hoàn tiền',
    'Send to: {account}': 'Chuyển vào: {account}',
    'No account given: contact the guest.': 'Khách chưa ghi tài khoản: liên hệ khách.',
    'Refunded by transfer': 'Đã hoàn bằng chuyển khoản',
    'Refunded in cash': 'Đã hoàn tiền mặt',
    'Record that {amount} went back to {name} by transfer?': 'Xác nhận đã chuyển khoản hoàn {amount} cho {name}?',
    'Record that {amount} went back to {name} in cash?': 'Xác nhận đã hoàn {amount} tiền mặt cho {name}?',
    'Studio keeps {amount}': 'Studio giữ lại {amount}',
    'Change the refund': 'Sửa số tiền hoàn',
    'The studio holds {amount}': 'Studio đang giữ {amount}',
    'All of it: {amount}': 'Toàn bộ: {amount}',
    'Half: {amount}': 'Một nửa: {amount}',
    'No refund': 'Không hoàn tiền',
    'Say why the refund changes.': 'Ghi lý do sửa số tiền hoàn.',
    'Save refund': 'Lưu số tiền hoàn',
    'Refund changed.': 'Đã sửa số tiền hoàn.',
    'Refund due': 'Chờ hoàn tiền',

    // Staff: bookings page (list, filter, calendar)
    'To refund {amount}': 'Cần hoàn {amount}',
    '{count} cancelled booking to refund': '{count} lượt đặt đã huỷ cần hoàn tiền',
    '{count} cancelled bookings to refund': '{count} lượt đặt đã huỷ cần hoàn tiền',

    // Admin: the policy editor
    'What guests get back when they cancel a booking.': 'Khách được hoàn bao nhiêu khi huỷ lượt đặt phòng.',
    'Full refund when cancelled early': 'Hoàn toàn bộ khi huỷ sớm',
    'Hours ahead': 'Trước giờ đặt (giờ)',
    'Partial refund': 'Hoàn một phần',
    'Refund (%)': 'Hoàn (%)',
    'Later than that: no refund.': 'Huỷ muộn hơn: không hoàn tiền.',
    'Guests see': 'Khách sẽ thấy',
    'Back to the default ({hours} hours, {percent}%)': 'Về mặc định ({hours} giờ, {percent}%)',
    'Hours are whole numbers from 1 to 720.': 'Số giờ là số nguyên từ 1 đến 720.',
    'The percent is a whole number from 0 to 100.': 'Phần trăm là số nguyên từ 0 đến 100.',
    'The full refund needs more hours than the partial one.': 'Mốc hoàn toàn bộ phải nhiều giờ hơn mốc hoàn một phần.',
    'Only an admin can change the policy.': 'Chỉ quản trị viên mới đổi được chính sách.',
    'Last changed {date}': 'Sửa lần cuối {date}',
    'Save policy': 'Lưu chính sách',
    'Cancellation policy saved.': 'Đã lưu chính sách huỷ.',

    // To-do
    'Refund {amount} to {guest}': 'Hoàn {amount} cho {guest}',
    'Cancelled booking · {room} on {date}': 'Lượt đặt đã huỷ · {room} ngày {date}',
    '{count} booking to refund': '{count} lượt đặt phòng cần hoàn tiền',
    '{count} bookings to refund': '{count} lượt đặt phòng cần hoàn tiền',
    '{amount} to give back': 'Tổng cần hoàn {amount}',

    // Activity log
    'Refund changed': 'Sửa tiền hoàn',
    '{actor} changed the refund for {name}’s booking to {amount}': '{actor} sửa tiền hoàn lượt đặt của {name} thành {amount}',
    '{actor} changed the cancellation policy': '{actor} đổi chính sách huỷ',
    '{amount} to refund': 'Cần hoàn {amount}',
};
