import {
    LuCamera,
    LuCircleEllipsis,
    LuClapperboard,
    LuHome,
    LuMegaphone,
    LuPartyPopper,
    LuShirt,
    LuShoppingBasket,
    LuSpeaker,
    LuWrench,
    LuZap,
} from 'react-icons/lu';

// One icon per expense category (keys from src/lib/expenseCategories.js).
export const CATEGORY_ICONS = {
    rent: LuHome,
    utilities: LuZap,
    video: LuClapperboard,
    costumes: LuShirt,
    shoot_location: LuCamera,
    equipment: LuSpeaker,
    marketing: LuMegaphone,
    events: LuPartyPopper,
    maintenance: LuWrench,
    supplies: LuShoppingBasket,
    other: LuCircleEllipsis,
};
