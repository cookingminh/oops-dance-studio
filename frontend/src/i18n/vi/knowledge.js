// AI knowledge, staff and admins (/admin/knowledge; services/knowledge.js) and its lines on the Activity page.
//   article → tài liệu · the assistant → trợ lý AI · draft → nháp · published → đã đăng · unpublish → gỡ xuống
// Some keys are longer than they'd need to be ("Article category", "In draft"…): the short words already mean
// something else in another area (Category → Nhóm chi, Draft → Chưa chốt, Title → Tên).
export default {
    // The page (sidebar, top bar, card)
    'AI knowledge': 'Kiến thức cho AI',
    'The facts the assistant may tell customers.': 'Những điều trợ lý AI được nói với khách.',
    'Knowledge articles': 'Tài liệu cho AI',
    'What the assistant will be able to tell customers. It only uses published articles; they don’t show on the website.': 'Những gì trợ lý AI sẽ được nói với khách. Trợ lý chỉ dùng tài liệu đã đăng; tài liệu không hiện trên website.',
    'Ask the assistant': 'Hỏi thử trợ lý',
    'Coming later': 'Sắp có',
    'New article': 'Thêm tài liệu',

    // Categories
    Policy: 'Chính sách',
    FAQ: 'Câu hỏi hay gặp',
    'Class guidance': 'Hướng dẫn chọn lớp',
    'House rules': 'Nội quy',

    // The list
    'Search by title': 'Tìm theo tiêu đề',
    'Article category': 'Loại tài liệu',
    'Any category': 'Tất cả loại',
    'Article status': 'Trạng thái tài liệu',
    Drafts: 'Nháp',
    'In draft': 'Nháp',
    '{count} article': '{count} tài liệu',
    '{count} articles': '{count} tài liệu',
    'Edited by {name} · {time}': '{name} sửa · {time}',
    'Edited {time}': 'Sửa {time}',
    'Published {time}': 'Đăng {time}',
    'No articles yet': 'Chưa có tài liệu nào',
    'Start with what customers ask most: prices, cancelling, which class to take.': 'Bắt đầu từ những gì khách hay hỏi nhất: giá, huỷ phòng, nên học lớp nào.',
    'No article fits': 'Không có tài liệu nào khớp',
    'Show every article': 'Xem tất cả tài liệu',

    // Writing tips
    'Writing for the assistant': 'Viết cho trợ lý AI',
    'One topic per article.': 'Mỗi tài liệu một chủ đề.',
    'Short, factual sentences.': 'Câu ngắn, đúng sự thật.',
    'Only real prices and real rules.': 'Chỉ ghi giá thật, quy định thật.',
    'Customers may read this: nothing private or internal.': 'Khách có thể đọc được: đừng ghi thông tin nội bộ.',

    // The editor
    'Back to the articles': 'Về danh sách tài liệu',
    'The article': 'Nội dung',
    'Article title': 'Tiêu đề',
    'As a customer would ask it: “How much back if I cancel?”': 'Viết như cách khách hỏi: “Huỷ phòng thì được hoàn bao nhiêu?”',
    'Article text': 'Nội dung tài liệu',
    'Markdown: # heading, **bold**, - list, | table |, [link](https://…). {count} of {max} characters.': 'Markdown: # tiêu đề, **in đậm**, - danh sách, | bảng |, [link](https://…). {count}/{max} ký tự.',
    'Show the text or its preview': 'Soạn hay xem trước',
    'Edit text': 'Soạn',
    'The text shows here as you write.': 'Nội dung hiện ở đây khi bạn gõ.',
    '(image: the assistant only reads text)': '(ảnh: trợ lý chỉ đọc được chữ)',
    'Save draft': 'Lưu nháp',
    Publish: 'Đăng',
    Unpublish: 'Gỡ xuống',
    'This article is published: saving changes the published text at once. To rework it out of sight, unpublish it first.': 'Tài liệu này đã đăng: lưu là đổi ngay bản đã đăng. Muốn sửa kín thì gỡ xuống trước.',
    'This article doesn’t exist any more': 'Tài liệu này không còn nữa',

    // What is missing, errors
    'Before publishing:': 'Trước khi đăng, cần:',
    'Give the article a title.': 'Đặt tiêu đề.',
    'Pick the article’s category.': 'Chọn loại tài liệu.',
    'Write the article’s text.': 'Viết nội dung.',
    'The title is up to 120 characters.': 'Tiêu đề tối đa 120 ký tự.',
    'The text is up to 20,000 characters.': 'Nội dung tối đa 20.000 ký tự.',
    'Give the article a title (up to 120 characters).': 'Đặt tiêu đề (tối đa 120 ký tự).',
    'Write the article’s text before publishing it.': 'Viết nội dung rồi mới đăng được.',

    // Text not saved yet, kept in this browser
    'Unsaved draft': 'Nháp chưa lưu',
    'Untitled article': 'Tài liệu chưa có tiêu đề',
    'Only on this device · {time}': 'Chỉ có trên máy này · {time}',
    'Unsaved changes on this device': 'Có thay đổi chưa lưu trên máy này',
    'Not saved yet, kept on this device': 'Chưa lưu, đang giữ trên máy này',
    'Discard changes': 'Bỏ thay đổi',
    'Discard the unsaved draft': 'Bỏ bản nháp chưa lưu',
    'Discard what isn’t saved?': 'Bỏ phần chưa lưu?',
    'This unsaved draft is gone for good.': 'Bản nháp chưa lưu này sẽ mất hẳn.',
    'The article goes back to what is saved.': 'Tài liệu trở về bản đã lưu.',
    'Discard it': 'Bỏ đi',
    'Carry on with your unsaved text?': 'Viết tiếp phần chưa lưu?',
    'You left “{name}” without saving ({time}). The text is kept on this device.': 'Bạn rời “{name}” khi chưa lưu ({time}). Phần đang viết được giữ trên máy này.',
    'The saved article has changed since then ({edited}). Saving your text replaces it.': 'Bản đã lưu vừa thay đổi sau đó ({edited}). Lưu phần của bạn sẽ đè lên.',
    'Carry on writing': 'Viết tiếp',

    // Saving, deleting, leaving
    'Draft saved': 'Đã lưu nháp',
    'Article published': 'Đã đăng tài liệu',
    'Changes published': 'Đã cập nhật bản đã đăng',
    'Article unpublished': 'Đã gỡ tài liệu xuống',
    'Article deleted': 'Đã xoá tài liệu',
    'Delete the article “{name}”?': 'Xoá tài liệu “{name}”?',
    'It’s published: the assistant won’t be able to use it any more. This can’t be undone.': 'Tài liệu đang đăng: xoá rồi trợ lý AI không dùng được nữa. Không khôi phục lại được.',
    'This draft is gone for good. This can’t be undone.': 'Bản nháp sẽ mất hẳn, không khôi phục lại được.',
    'Delete article': 'Xoá tài liệu',
    'Your changes to this article will be lost.': 'Những gì vừa sửa trong tài liệu này sẽ mất.',

    // Activity page
    'Knowledge article added': 'Thêm tài liệu cho AI',
    'Knowledge article edited': 'Sửa tài liệu cho AI',
    'Knowledge article published': 'Đăng tài liệu cho AI',
    'Knowledge article unpublished': 'Gỡ tài liệu cho AI',
    'Knowledge article deleted': 'Xoá tài liệu cho AI',
    '{actor} wrote the knowledge article “{name}”': '{actor} viết tài liệu cho AI “{name}”',
    '{actor} edited the knowledge article “{name}”': '{actor} sửa tài liệu cho AI “{name}”',
    '{actor} published the knowledge article “{name}”': '{actor} đăng tài liệu cho AI “{name}”',
    '{actor} unpublished the knowledge article “{name}”': '{actor} gỡ tài liệu cho AI “{name}” xuống',
    '{actor} deleted the knowledge article “{name}”': '{actor} xoá tài liệu cho AI “{name}”',
    '{actor} wrote {count} knowledge articles': '{actor} viết {count} tài liệu cho AI',
    '{actor} edited the knowledge article “{name}” {count} times': '{actor} sửa tài liệu cho AI “{name}” {count} lần',
    '{actor} edited {count} knowledge articles': '{actor} sửa {count} tài liệu cho AI',
    '{actor} published {count} knowledge articles': '{actor} đăng {count} tài liệu cho AI',
    '{actor} unpublished {count} knowledge articles': '{actor} gỡ {count} tài liệu cho AI xuống',
    '{actor} deleted {count} knowledge articles': '{actor} xoá {count} tài liệu cho AI',
};
