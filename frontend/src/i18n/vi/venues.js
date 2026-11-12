// Vietnamese: rented studios (venues) — where a class is taught (a room or a rented studio), the "Rented
// studios" section of Bookings → Rooms & prices, the automatic studio rent in Expenses, and their Activity lines.
// Terms: rented studio → studio thuê ngoài · where it's taught / place → nơi dạy · rent → tiền thuê / giá thuê ·
// inactive → ngừng dùng.
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
    Address: 'Địa chỉ',
    'Street, ward, district': 'Số nhà, đường, phường, quận',
    'Map link': 'Link bản đồ',
    'The map link must start with https://.': 'Link bản đồ phải bắt đầu bằng https://.',
    'Without one, “Open in Maps” searches the address.': 'Không có link thì “Xem bản đồ” sẽ tìm theo địa chỉ.',
    'Optional. Paste the studio’s Google Maps link.': 'Không bắt buộc. Dán link Google Maps của studio.',
    'Rent per hour (VND)': 'Giá thuê mỗi giờ (VND)',
    'Each session taught there adds its rent to the class’s costs.': 'Mỗi buổi dạy ở đây sẽ cộng tiền thuê vào chi phí của lớp.',
    '{rent} an hour: a 90-minute session costs {session}.': '{rent} một giờ: một buổi 90 phút mất {session}.',
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

    // Server errors (services/errors.js)
    'Classes were taught at this studio, so it can’t be deleted. Set it inactive instead.': 'Đã có lớp dạy ở studio này nên không xoá được. Hãy chuyển sang ngừng dùng.',
    'Give the studio a name (up to 100 characters).': 'Đặt tên cho studio (tối đa 100 ký tự).',
    'There is already a rented studio with this name.': 'Đã có studio thuê ngoài trùng tên này.',
    'The rent must be 0 or more.': 'Giá thuê phải từ 0 trở lên.',
    'A class is taught in one place: a room or a rented studio.': 'Mỗi lớp chỉ dạy ở một nơi: một phòng hoặc một studio thuê ngoài.',
};
