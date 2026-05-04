import React from 'react';
import { C } from './constants';
import type { ActiveTab } from './types';

interface Props {
  activeTab: ActiveTab;
  openCount: number;
  historyCount: number;
  historyPulse: boolean;
  onTabChange: (t: ActiveTab) => void;
}

export const TabSwitcher: React.FC<Props> = ({
  activeTab, openCount, historyCount, historyPulse, onTabChange,
}) => {
  const tabs: { id: ActiveTab; label: string; count: number; hasPulse?: boolean }[] = [
    { id: 'positions', label: 'Open Positions', count: openCount },
    { id: 'history',   label: "Today's History", count: historyCount, hasPulse: historyPulse },
  ];

  return (
    <div style={{
      display: 'inline-flex',
      background: C.innerRowBg,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 24,
      padding: 3,
      gap: 2,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              background: isActive ? C.blue : 'transparent',
              border: 'none',
              borderRadius: 20,
              padding: '8px 18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              color: isActive ? '#fff' : C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 0.2s',
              boxShadow: isActive ? '0 2px 12px rgba(59,130,246,0.3)' : 'none',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.hasPulse && (
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: C.accentGreen,
                display: 'inline-block',
                animation: 'igd-pulse 2s infinite',
                boxShadow: `0 0 6px ${C.accentGreen}`,
              }} />
            )}
            {tab.label}
            <span style={{
              background: isActive ? 'rgba(255,255,255,0.2)' : C.cardBorder,
              color: isActive ? '#fff' : C.textMuted,
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
              minWidth: 20,
              textAlign: 'center',
            }}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
