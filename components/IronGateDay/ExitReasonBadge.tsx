import React from 'react';

type ExitReason = 'TARGET_HIT' | 'STOP_LOSS' | 'EOD' | 'ST_1H_FLIP' | 'STALE_8H';
type Result = 'WIN' | 'LOSS' | 'BREAKEVEN';

const REASON_CONFIG: Record<ExitReason, { icon: string; color: string; bg: string; border: string }> = {
  TARGET_HIT:  { icon: 'Target',    color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)' },
  STOP_LOSS:   { icon: 'Stop',      color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)' },
  EOD:         { icon: 'Clock',     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.4)' },
  ST_1H_FLIP:  { icon: 'Trend',     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.4)' },
  STALE_8H:    { icon: 'Timer',     color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
};

const RESULT_CONFIG: Record<Result, { emoji: string; color: string; bg: string; border: string }> = {
  WIN:       { emoji: 'WIN',       color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.5)' },
  LOSS:      { emoji: 'LOSS',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.5)' },
  BREAKEVEN: { emoji: 'BREAKEVEN', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.3)' },
};

export const ExitReasonBadge: React.FC<{ reason: ExitReason }> = ({ reason }) => {
  const cfg = REASON_CONFIG[reason] || REASON_CONFIG['EOD'];
  const labels: Record<ExitReason, string> = {
    TARGET_HIT: 'Target Hit',
    STOP_LOSS:  'Stop Loss',
    EOD:        'EOD Close',
    ST_1H_FLIP: 'ST Flip',
    STALE_8H:   'Stale 8H',
  };
  return (
    <span style={{
      padding: '3px 8px',
      borderRadius: 6,
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      color: cfg.color,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '0.04em',
    }}>
      {labels[reason]}
    </span>
  );
};

export const ResultBadge: React.FC<{ result: Result }> = ({ result }) => {
  const cfg = RESULT_CONFIG[result];
  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: 20,
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      color: cfg.color,
      fontSize: 11,
      fontWeight: 900,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '0.06em',
    }}>
      {cfg.emoji}
    </span>
  );
};
