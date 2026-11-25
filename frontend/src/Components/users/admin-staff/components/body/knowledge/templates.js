// Ready-made articles to fill in, one per kind. {{…}} marks a blank: the editor highlights it and selects it on a click,
// and an article can't be published while one is left (knowledgeModel.js). The texts are Vietnamese, as the articles
// are; their names and hints are English i18n keys.

export const BLANK = /\{\{[^{}\n]{1,80}\}\}/g;
export const blanksIn = (text) => (text.match(BLANK) ?? []).length;

export const TEMPLATES = [
    {
        key: 'policy',
        category: 'policy',
        label: 'A rule with money in it',
        hint: 'Cancelling, refunds, deposits',
        titleHint: 'As a customer would ask it: “How much back if I cancel?”',
        body: `Áp dụng cho {{ai, việc gì: ví dụ khách thuê phòng tập}}.

## Quy định

| Huỷ trước giờ bắt đầu | Được hoàn |
| - | - |
| {{trên 24 giờ}} | {{100% tiền cọc}} |
| {{dưới 24 giờ}} | {{50% tiền cọc}} |

## Cách làm

1. {{Bước 1}}
2. {{Bước 2}}

## Lưu ý

- {{Trường hợp đặc biệt, nếu có}}`,
    },
    {
        key: 'faq',
        category: 'faq',
        label: 'A question customers ask',
        hint: 'A short answer, then the details',
        titleHint: 'The question, as customers ask it: “Can I park my motorbike?”',
        body: `{{Trả lời ngắn trong 1–2 câu: có hay không, bao nhiêu tiền, ở đâu.}}

## Chi tiết

- {{Ý thứ nhất}}
- {{Ý thứ hai}}

## Cần hỏi thêm

{{Khách liên hệ ai, bằng cách nào.}}`,
    },
    {
        key: 'class',
        category: 'class',
        label: 'About a class',
        hint: 'Who it is for, times, price, what to bring',
        titleHint: 'For example: “What does the K-pop Dance class learn?”',
        body: `Lớp {{tên lớp}} dành cho {{ai: người mới, người đã học vài tháng…}}.

## Lịch học

| Ngày | Giờ | Nơi học |
| - | - | - |
| {{Thứ Hai}} | {{18:30–19:45}} | {{địa chỉ}} |

## Học phí

{{Số tiền}} cho {{số buổi}} buổi.

## Cần chuẩn bị

- {{Giày, quần áo, nước…}}

## Đăng ký

{{Cách đăng ký: trên web, nhắn tin…}}`,
    },
    {
        key: 'house_rules',
        category: 'house_rules',
        label: 'House rules',
        hint: 'Before, during and after a session',
        titleHint: 'For example: “House rules of the practice rooms”',
        body: `## Trước khi vào phòng

1. {{Quy định}}
2. {{Quy định}}

## Trong lúc tập

1. {{Quy định}}

## Khi ra về

1. {{Quy định}}`,
    },
];
