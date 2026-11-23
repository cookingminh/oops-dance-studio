import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

// toast.success('Saved'), toast.error(errorOrMessage), each with an optional { action: { label, onPress } } (a button in the
// toast, e.g. "Open booking"; pressing it closes the toast).
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used inside <ToastProvider>');
    return context;
}
