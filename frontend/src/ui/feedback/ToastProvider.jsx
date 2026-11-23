import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toastContext';
import { useI18n } from '@/i18n/i18nContext';

const STYLES = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
};

// Messages are English source text (static toasts, service errors) and are translated when shown.
export function ToastProvider({ children }) {
    const { t } = useI18n();
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

    // A toast with an action stays longer, so there is time to press it.
    const show = useCallback((type, message, timeout = 4500, action = null) => {
        const id = ++nextId.current;
        setToasts((list) => [...list, { id, type, message, action }]);
        setTimeout(() => dismiss(id), action ? Math.max(timeout, 10000) : timeout);
    }, [dismiss]);

    const api = useMemo(() => ({
        success: (message, { action } = {}) => show('success', message, 4500, action),
        info: (message, { action } = {}) => show('info', message, 4500, action),
        error: (error, { action } = {}) => show('error', typeof error === 'string' ? error : error?.message ?? 'Something went wrong.', 7000, action),
    }), [show]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            {/* data-react-aria-top-layer keeps toasts readable while a NextUI modal hides the rest of the page. */}
            <div aria-live="polite" data-react-aria-top-layer="true" className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role={toast.type === 'error' ? 'alert' : 'status'}
                        className={`${STYLES[toast.type]} text-white text-sm rounded-xl shadow-lg px-4 py-3 flex items-start gap-3`}
                    >
                        <span className="flex-1">
                            {t(toast.message)}
                            {toast.action && (
                                <button
                                    type="button"
                                    className="mt-2 block rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
                                    onClick={() => {
                                        dismiss(toast.id);
                                        toast.action.onPress();
                                    }}
                                >
                                    {t(toast.action.label)}
                                </button>
                            )}
                        </span>
                        <button type="button" aria-label={t('Dismiss')} className="opacity-80 hover:opacity-100" onClick={() => dismiss(toast.id)}>
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
