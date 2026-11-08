import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toastContext';

const STYLES = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

    const show = useCallback((type, message, timeout = 4500) => {
        const id = ++nextId.current;
        setToasts((list) => [...list, { id, type, message }]);
        setTimeout(() => dismiss(id), timeout);
    }, [dismiss]);

    const api = useMemo(() => ({
        success: (message) => show('success', message),
        info: (message) => show('info', message),
        error: (error) => show('error', typeof error === 'string' ? error : error?.message ?? 'Something went wrong.', 7000),
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
                        <span className="flex-1">{toast.message}</span>
                        <button type="button" aria-label="Dismiss" className="opacity-80 hover:opacity-100" onClick={() => dismiss(toast.id)}>
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
