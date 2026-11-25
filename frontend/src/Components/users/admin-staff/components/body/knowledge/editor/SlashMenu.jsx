import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/i18nContext';

const GAP = 6;

// The "/" menu: what can be inserted, next to the cursor. Arrow keys and Enter pick, Escape closes (the editor keeps the
// focus all along); the mouse works too. `keys` is a ref the editor calls with each key while the menu is open.
const SlashMenu = ({ state, keys, onClose }) => {
    const { t } = useI18n();
    const { items, query } = state;
    const [index, setIndex] = useState(0);
    const [place, setPlace] = useState(null);
    const menu = useRef(null);

    useEffect(() => setIndex(0), [query]);

    keys.current = (event) => {
        if (event.isComposing) return false;
        if (event.key === 'Escape') {
            onClose();
            return true;
        }
        if (!items.length) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setIndex((current) => (current + step + items.length) % items.length);
            return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            state.command(items[Math.min(index, items.length - 1)]);
            return true;
        }
        return false;
    };

    // Under the cursor, or above it when there is no room.
    useLayoutEffect(() => {
        const cursor = state.clientRect?.();
        if (!cursor || !menu.current) return;
        const { offsetWidth: width, offsetHeight: height } = menu.current;
        const below = cursor.bottom + GAP + height <= window.innerHeight;
        setPlace({
            left: Math.max(8, Math.min(cursor.left, window.innerWidth - width - 8)),
            top: below ? cursor.bottom + GAP : Math.max(8, cursor.top - GAP - height),
        });
    }, [state, items.length]);

    useEffect(() => {
        menu.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [index]);

    if (!items.length) return null;
    return createPortal(
        <div ref={menu} className="adminPortal kbSlash" role="listbox" aria-label={t('Insert')} style={place ?? { visibility: 'hidden' }}>
            {items.map((item, at) => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="option"
                        aria-selected={at === index}
                        onMouseEnter={() => setIndex(at)}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            state.command(item);
                        }}
                    >
                        <span className="kbSlashIcon" aria-hidden="true">
                            <Icon />
                        </span>
                        <span>
                            <strong>{t(item.label)}</strong>
                            <small>{t(item.hint)}</small>
                        </span>
                    </button>
                );
            })}
        </div>,
        document.body
    );
};

export default SlashMenu;
