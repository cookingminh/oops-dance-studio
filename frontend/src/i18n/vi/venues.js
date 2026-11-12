// Vietnamese: rented studios (venues) and their rooms — where a class is taught (a room, a rented studio or one of
// its rooms), the "Rented studios" section of Bookings → Rooms & prices, the automatic studio rent in Expenses, and
// their Activity lines.
// Terms: rented studio → studio thuê ngoài · where it's taught / place → nơi dạy · rent → tiền thuê / giá thuê ·
// inactive → ngừng dùng · a rented studio's room → phòng · name on the website → tên hiển thị trên website.
export default {
    // Where a class is taught (src/ui/place, lib/place.js)
    'Open {name} in Maps': 'Mở {name} trên bản đồ',
    'Open in Maps': 'Xem bản đồ',
    Place: 'Nơi dạy',
    'Where it’s taught': 'Nơi dạy',
    'Where we dance': 'Nơi tập',
    'Studio rooms': 'Phòng của studio',
    'Rented studios': 'Studio thuê ngoài',
    '{rent}/h': '{rent}/giờ',
    Inactive: 'Ngừng dùng',
    'Its rent ({rent}/h × each session’s length) is added to the class’s costs after each session.':
        'Tiền thuê ({rent}/giờ × thời lượng buổi) tự cộng vào chi phí của lớp sau mỗi buổi.',
    'The room’s rent ({rent}/h × each session’s length) is added to the class’s costs after each session.':
        'Tiền thuê phòng ({rent}/giờ × thời lượng buổi) tự cộng vào chi phí của lớp sau mỗi buổi.',
    'No room picked': 'Chưa chọn phòng',
    'The studio’s price: {rent}': 'Giá chung của studio: {rent}',
    'Name, instructor, where it’s taught, price, start date and level': 'Tên, giáo viên, nơi dạy, học phí, ngày bắt đầu và cấp độ',
    '{count} sessions a week · colours show where': '{count} buổi/tuần · mỗi màu là một nơi dạy',
    '{venue} is a rented studio: check with them that it’s free then.': '{venue} là studio thuê ngoài: nhớ hỏi bên đó xem giờ này còn trống không.',
    'The studio': 'Studio',

    // Bookings → Rooms & prices → Rented studios
    'Studios rented by the hour to teach classes in. Choose one in a class’s Setup; the rent of each session taught there is added to the class’s costs.':
        'Các studio thuê theo giờ để dạy lớp. Chọn studio trong mục Setting của lớp; tiền thuê của mỗi buổi dạy ở đó tự cộng vào chi phí của lớp.',
    'Add a rented studio': 'Thêm studio thuê ngoài',
    'No rented studios yet.': 'Chưa có studio thuê ngoài nào.',
    'No address yet': 'Chưa có địa chỉ',
    'Classes here': 'Lớp dạy ở đây',
    'None right now': 'Hiện chưa có',
    'Visitors and students see this instead of the studio’s name.': 'Khách xem website và học viên thấy tên này thay cho tên studio.',
    'No classes in it': 'Chưa có lớp nào',
    'No room picked: {rent}/h': 'Chưa chọn phòng: {rent}/giờ',
    'Classes with no room picked': 'Lớp chưa chọn phòng',
    'Rent this month': 'Tiền thuê tháng này',
    'Delete {name}? This can’t be undone.': 'Xoá {name}? Không thể hoàn tác.',
    '{name} deleted.': 'Đã xoá {name}.',
    '{name} saved.': 'Đã lưu {name}.',
    '{name} added.': 'Đã thêm {name}.',
    '{name} is inactive.': 'Đã ngừng dùng {name}.',
    'Classes were taught at {name}, so it stays on record. It is already inactive.':
        'Đã có lớp dạy ở {name} nên studio được giữ lại trong hồ sơ. Studio này đã ngừng dùng rồi.',
    'Classes were taught at {name}, so it can’t be deleted. Set it inactive instead? It leaves the class pickers and its history stays.':
        'Đã có lớp dạy ở {name} nên không xoá được. Chuyển sang ngừng dùng nhé? Studio sẽ không còn trong danh sách chọn nơi dạy, lịch sử vẫn được giữ.',

    // The add / edit dialog
    'A studio rented by the hour, where classes can be taught.': 'Studio thuê theo giờ để dạy lớp.',
    'Studio name': 'Tên studio',
    'Give the studio a name.': 'Đặt tên cho studio.',
    'For staff, instructors and admins.': 'Tên này chỉ nhân viên, giáo viên và admin thấy.',
    'Name on the website': 'Tên hiển thị trên website',
    'e.g. Bà Triệu': 'VD: Bà Triệu',
    'Visitors and students see this instead of the studio’s name, which is another studio’s brand. Left empty: the first part of the address.':
        'Khách xem website và học viên sẽ thấy tên này thay cho tên studio (đó là thương hiệu của studio khác). Để trống thì lấy phần đầu của địa chỉ.',
    Address: 'Địa chỉ',
    'Street, ward, district': 'Số nhà, đường, phường, quận',
    'Map link': 'Link bản đồ',
    'The map link must start with https://.': 'Link bản đồ phải bắt đầu bằng https://.',
    'Without one, “Open in Maps” searches the address.': 'Không có link thì “Xem bản đồ” sẽ tìm theo địa chỉ.',
    'Optional. Paste the studio’s Google Maps link.': 'Không bắt buộc. Dán link Google Maps của studio.',
    'Rent per hour (VND)': 'Giá thuê mỗi giờ (VND)',
    'Each session taught there adds its rent to the class’s costs.': 'Mỗi buổi dạy ở đây sẽ cộng tiền thuê vào chi phí của lớp.',
    '{rent} an hour: a 90-minute session costs {session}.': '{rent} một giờ: một buổi 90 phút mất {session}.',
    'The price when a class here has no room picked. Each room has its own price below.':
        'Giá áp dụng khi lớp dạy ở đây chưa chọn phòng. Mỗi phòng có giá riêng ở bên dưới.',
    'A studio with more than one room: add each with its own price per hour. A class then picks its room in Setup.':
        'Studio có nhiều phòng thì thêm từng phòng với giá thuê mỗi giờ riêng, rồi chọn phòng cho lớp trong mục Setting.',
    'Room name': 'Tên phòng',
    'Give the room a name.': 'Đặt tên cho phòng.',
    'Two rooms have this name.': 'Có hai phòng trùng tên này.',
    'Move {name} up': 'Đưa {name} lên trên',
    'Use {name} again': 'Dùng lại {name}',
    'Use again': 'Dùng lại',
    'Remove {name}': 'Bỏ {name}',
    'this room': 'phòng này',
    'Add a room': 'Thêm phòng',
    '{classes} are taught in {room}. Remove it anyway? It stays on record as inactive and they keep it until you move them.':
        'Lớp {classes} đang dạy ở {room}. Vẫn bỏ phòng này? Phòng sẽ chuyển sang ngừng dùng, các lớp đó vẫn ở phòng này cho tới khi bạn chuyển lớp.',
    'A removed room a class or a session was in can’t be deleted: it stays on record as inactive, out of the class pickers.':
        'Phòng đã từng có lớp hoặc buổi học thì không xoá hẳn được: phòng sẽ chuyển sang ngừng dùng và không còn trong danh sách chọn nơi dạy.',
    'Note for staff': 'Ghi chú cho nhân viên',
    'Who to call, how to get the key…': 'Gọi cho ai, lấy chìa khoá ở đâu…',
    'In use': 'Đang dùng',
    'Classes can be put here.': 'Có thể xếp lớp vào đây.',
    'Out of the class pickers; its history stays.': 'Không còn trong danh sách chọn nơi dạy; lịch sử vẫn được giữ.',
    'Save studio': 'Lưu studio',
    'Add studio': 'Thêm studio',

    // Expenses: the automatic studio rent
    'Studio rent': 'Thuê studio ngoài',
    'A rented studio’s hourly rent for a class session. Added by itself after each session there.':
        'Tiền thuê studio ngoài theo giờ cho một buổi học. Tự thêm sau mỗi buổi dạy ở đó.',
    'Rent at {vendor}: {class}, {time}': 'Thuê {vendor}: {class}, {time}',
    'Studio rent: {class}, {time}': 'Tiền thuê studio: {class}, {time}',
    Automatic: 'Tự động',
    'Added by itself after each session at a rented studio, and taken off if that session is called off.':
        'Tự thêm sau mỗi buổi dạy ở studio thuê ngoài, và tự bỏ đi nếu buổi đó bị huỷ.',
    'Delete “{name}”? That session’s rent won’t be charged again. If the session didn’t happen, call it off instead: that takes its rent off too.':
        'Xoá “{name}”? Buổi đó sẽ không bị tính tiền thuê nữa. Nếu buổi học không diễn ra thì nên huỷ buổi: tiền thuê cũng tự được xoá.',

    // Activity
    'Rented studio added': 'Thêm studio thuê ngoài',
    'Rented studio edited': 'Sửa studio thuê ngoài',
    'Rented studio deleted': 'Xoá studio thuê ngoài',
    'Rented studio': 'Studio thuê ngoài',
    'Rent per hour': 'Giá thuê mỗi giờ',
    '{actor} moved {class} to {place}': '{actor} đã chuyển lớp {class} sang {place}',
    '{actor} took {class} out of its room or studio': '{actor} đã bỏ nơi dạy của lớp {class}',
    'Was at {place}': 'Trước đó ở {place}',
    '{actor} added the rented studio {title}': '{actor} đã thêm studio thuê ngoài {title}',
    '{actor} deleted the rented studio {title}': '{actor} đã xoá studio thuê ngoài {title}',
    '{actor} edited the rented studio {title}': '{actor} đã sửa studio thuê ngoài {title}',
    '{actor} set the rented studio {title} inactive': '{actor} đã ngừng dùng studio thuê ngoài {title}',
    '{actor} made the rented studio {title} active again': '{actor} đã dùng lại studio thuê ngoài {title}',
    'Was {name}': 'Tên cũ: {name}',
    'Rent {from} → {to} per hour': 'Giá thuê {from} → {to} mỗi giờ',
    'Room at the studio': 'Phòng ở studio',
    'Rooms: {changes}': 'Phòng: {changes}',
    '{name} added': 'thêm {name}',
    '{name} removed': 'bỏ {name}',
    '{name} set inactive': '{name} ngừng dùng',
    '{name} in use again': 'dùng lại {name}',
    'new order': 'đổi thứ tự',

    // Server errors (services/errors.js)
    'Classes were taught at this studio, so it can’t be deleted. Set it inactive instead.': 'Đã có lớp dạy ở studio này nên không xoá được. Hãy chuyển sang ngừng dùng.',
    'Give the studio a name (up to 100 characters).': 'Đặt tên cho studio (tối đa 100 ký tự).',
    'There is already a rented studio with this name.': 'Đã có studio thuê ngoài trùng tên này.',
    'The rent must be 0 or more.': 'Giá thuê phải từ 0 trở lên.',
    'The name on the website is up to 80 characters.': 'Tên hiển thị trên website tối đa 80 ký tự.',
    'Two rooms have the same name.': 'Có hai phòng trùng tên.',
    'Give each room a name (up to 60 characters).': 'Đặt tên cho từng phòng (tối đa 60 ký tự).',
    'A room’s rent must be 0 or more.': 'Giá thuê phòng phải từ 0 trở lên.',
    'A class is taught in one place: a room or a rented studio.': 'Mỗi lớp chỉ dạy ở một nơi: một phòng hoặc một studio thuê ngoài.',
};
