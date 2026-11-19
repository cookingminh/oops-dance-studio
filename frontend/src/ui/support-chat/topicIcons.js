import {
    LuArrowLeftRight,
    LuBanknote,
    LuCalendarDays,
    LuCalendarX2,
    LuCamera,
    LuDoorOpen,
    LuSparkles,
    LuUserCircle,
    LuUsers,
    LuWallet,
} from 'react-icons/lu';

// An icon for each topic of a new question (services/support.js CUSTOMER_TOPICS / INSTRUCTOR_TOPICS).
export const TOPIC_ICONS = {
    booking: LuDoorOpen,
    classes: LuCalendarDays,
    tuition: LuWallet,
    absence: LuCalendarX2,
    account: LuUserCircle,
    other: LuSparkles,
    checkin: LuCamera,
    payroll: LuBanknote,
    cover: LuArrowLeftRight,
    teaching: LuUsers,
};
