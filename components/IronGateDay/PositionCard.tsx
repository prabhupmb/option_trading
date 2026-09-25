import React from 'react';
import { C } from './constants';
import { TierBadge, TierSquare } from './TierBadge';
import { ActionBadge } from './ActionBadge';
import TradeChart from '../signals/TradeChart';
import type { Bar } from '../../lib/supertrend';
import type { Timeframe } from '../../hooks/useMdBars';
import type { IronGateDayPosition } from './types';

interface Props {
  pos: IronGateDayPosition;
  bars?: Bar[];
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
  isFlashing?: boolean;
  isUpdated?: boolean;
  isMarketOpen?: boolean;
  onExecute?: (signal: any) => void;
}

function fmt(n: number | null | undefined) {
  if (n == null) return '-';
  return `$${Number(n).toFixed(2)}`;
}

function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export const PositionCard: React.FC<Props> = ({ pos, bars, tf, onTfChange, isFlashing, isUpdated, isMarketOpen = true, onExecute }) => {
  const isBuy = pos.action === 'BUY';
  const current = pos.current_price ?? pos.entry_price;
  const pnlPct = pos.pnl_pct ?? 0;
  const pnlDollars = pos.pnl_dollars ?? 0;
  const isProfit = pnlPct >= 0;

  const cardBorder = isFlashing
    ? (isBuy ? 'rgba(22,163,74,0.8)' : 'rgba(220,38,38,0.8)')
    : C.cardBorder;
  const cardGlow = isFlashing
    ? (isBuy ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)')
    : pos.tier === 'A+' && isBuy
    ? 'rgba(22,163,74,0.06)'
    : pos.tier === 'A+' && !isBuy
    ? 'rgba(220,38,38,0.06)'
    : 'none';

  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      boxShadow: cardGlow !== 'none' ? `0 0 20px ${cardGlow}` : 'none',
      animation: isFlashing ? 'igd-flash-in 0.4s ease' : isUpdated ? 'igd-pulse 0.5s ease' : 'none',
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* -- Top Row: Badge + Symbol + Price + P&L -- */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <TierSquare tier={pos.tier} symbol={pos.symbol} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary, letterSpacing: '-0.02em' }}>
                {pos.symbol}
              </span>
              <ActionBadge action={pos.action} tier={pos.tier} />
              <TierBadge tier={pos.tier} />
              {pos.signal_type && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {pos.signal_type}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary }}>
                {fmt(current)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: isProfit ? C.accentGreen : C.accentRed }}>
                {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: isProfit ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)' }}>
                ({isProfit ? '+' : ''}{fmt(pnlDollars)})
              </span>
            </div>
          </div>
        </div>

        {/* -- TradeChart -- */}
        <TradeChart
          bars={bars ?? []}
          entryPrice={pos.entry_price}
          stopLoss={pos.stop_loss}
          target1={pos.target_1}
          target2={pos.target_2 || undefined}
          currentPrice={current}
          optionType={isBuy ? 'CALL' : 'PUT'}
          tf={tf}
          onTfChange={onTfChange}
        />

        {/* -- Footer -- */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          color: C.textMuted,
          borderTop: `1px solid ${C.cardBorder}`,
          paddingTop: 10,
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <span>Opened <span style={{ color: C.textSecondary }}>{timeSince(pos.opened_at)}</span></span>
            <span>Last check <span style={{ color: C.textSecondary }}>{timeSince(pos.last_checked_at)}</span></span>
            <span style={{ color: C.textMuted }}>
              Checks: <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{pos.check_count || 0}</span>
            </span>
            {pos.version && (
              <span style={{ color: C.textMuted }}>
                <span style={{ color: C.accentYellow, fontWeight: 700 }}>#{pos.source || 'IG-DAY'}</span> {pos.version}
              </span>
            )}
          </div>
          {onExecute && (
            <button
              onClick={() => onExecute({
                id: pos.id,
                symbol: pos.symbol,
                current_price: pos.current_price ?? pos.entry_price,
                option_type: (isBuy ? 'CALL' : 'PUT') as 'CALL' | 'PUT',
                tier: pos.tier as 'A+' | 'A' | 'B+' | 'NO_TRADE',
                trading_recommendation: pos.trading_recommendation || '',
                gates_passed: `${pos.gate_score || 0}/5`,
                adx_value: pos.adx_value || 0,
                adx_trend: 'MODERATE' as const,
                fib_target1: pos.target_1 || 0,
                fib_target2: pos.target_2 || 0,
                fib_stop_loss: pos.stop_loss || 0,
                risk_reward_ratio: `1:${(pos.risk_reward_ratio || 0).toFixed(1)}`,
                analyzed_at: pos.opened_at || '',
                signal_source: 'iron_gate_day' as const,
                signal_position_id: pos.id,
                entry_price: pos.entry_price,
                target_price: pos.target_1,
                stop_loss: pos.stop_loss,
                signal_text: pos.signal || '',
                opened_at: pos.opened_at,
              })}
              disabled={!isMarketOpen}
              title={!isMarketOpen ? 'Market closed' : `Buy ${isBuy ? 'CALL' : 'PUT'} option on ${pos.symbol}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: isMarketOpen ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                flexShrink: 0,
                ...(isMarketOpen
                  ? isBuy
                    ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', color: C.accentGreen }
                    : { background: 'transparent', border: `1px solid ${C.accentRed}`, color: C.accentRed }
                  : { background: C.innerRowBg, border: `1px solid ${C.cardBorder}`, color: C.textMuted, opacity: 0.5 }
                ),
              }}
            >
              <span style={{ fontSize: 12 }}>&#9889;</span>
              Buy {isBuy ? 'Call' : 'Put'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
