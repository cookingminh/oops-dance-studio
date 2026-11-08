import { useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { DEMO_MODE } from '@/lib/demo';

const DISMISSED_KEY = 'oops-demo-banner-dismissed';

const readDismissed = () => {
    try {
        return sessionStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
};

// Shown on every page of the public demo until the visitor hides it for this tab.
const DemoBanner = () => {
    const [dismissed, setDismissed] = useState(readDismissed);
    if (!DEMO_MODE || dismissed) return null;

    const dismiss = () => {
        try {
            sessionStorage.setItem(DISMISSED_KEY, '1');
        } catch {
            // storage unavailable: hide until the next page load
        }
        setDismissed(true);
    };

    return (
        <div className="demoBanner" role="note">
            <span>Demo data, resets every 6 hours</span>
            <button type="button" aria-label="Hide demo notice" onClick={dismiss}>
                <IoClose />
            </button>
        </div>
    );
};

export default DemoBanner;
