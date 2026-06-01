import React, { useState, useEffect } from 'react';
import { useAnnouncement } from '../services/useAnnouncement';

const STYLES = {
    info: {
        bg: 'bg-[#00BCD4]/10 border-[#00BCD4]/30',
        text: 'text-[#00BCD4]',
        icon: 'info',
        dot: 'bg-[#00BCD4]',
    },
    warning: {
        bg: 'bg-amber-500/10 border-amber-500/30',
        text: 'text-amber-400',
        icon: 'warning',
        dot: 'bg-amber-400',
    },
    success: {
        bg: 'bg-rh-green/10 border-rh-green/30',
        text: 'text-rh-green',
        icon: 'campaign',
        dot: 'bg-rh-green',
    },
};

const AnnouncementBanner: React.FC = () => {
    const announcement = useAnnouncement();
    const [dismissedId, setDismissedId] = useState<string | null>(null);

    // Reset dismissed state when a new announcement comes in
    useEffect(() => {
        if (announcement && announcement.id !== dismissedId) {
            setDismissedId(null);
        }
    }, [announcement?.id]);

    if (!announcement || announcement.id === dismissedId) return null;

    const style = STYLES[announcement.type] ?? STYLES.info;

    return (
        <div className={`flex items-center gap-3 px-5 py-2.5 border-b ${style.bg} border-opacity-50 flex-shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${style.dot}`} />
            <span className={`material-symbols-outlined text-lg flex-shrink-0 ${style.text}`}>
                {style.icon}
            </span>
            <p className={`text-sm font-medium flex-1 ${style.text}`}>
                {announcement.message}
            </p>
            <button
                onClick={() => setDismissedId(announcement.id)}
                className={`flex-shrink-0 ${style.text} opacity-60 hover:opacity-100 transition-opacity`}
                title="Dismiss"
            >
                <span className="material-symbols-outlined text-lg">close</span>
            </button>
        </div>
    );
};

export default AnnouncementBanner;
