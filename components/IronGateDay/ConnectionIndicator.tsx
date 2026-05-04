import React from 'react';
import type { ConnectionStatus } from './types';

interface Props {
  status: ConnectionStatus;
}

const config = {
  connected:    { color: '#22C55E', label: 'Live', pulse: true },
  idle:         { color: '#FFD700', label: 'Idle', pulse: false },
  disconnected: { color: '#EF4444', label: 'Offline', pulse: false },
};

export const ConnectionIndicator: React.FC<Props> = ({ status }) => {
  const { color, label, pulse } = config[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          animation: pulse ? 'igd-pulse 2s infinite' : 'none',
          boxShadow: pulse ? `0 0 6px ${color}` : 'none',
        }}
      />
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
};
