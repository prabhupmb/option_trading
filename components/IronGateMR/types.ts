/* ── Iron Gate MR — types mirroring Supabase columns exactly ── */

export interface MROpenPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  option_type: 'CALL' | 'PUT';
  corr_group: string | null;
  signal_date: string | null;
  entry_price: number;
  entry_at: string | null;
  stop_loss: number;
  atr14: number | null;
  atr_pct: number | null;
  rsi2_at_signal: number | null;
  sma5_at_signal: number | null;
  sma200_at_signal: number | null;
  suggested_qty: number | null;
  risk_dollars: number | null;
  notional: number | null;
  option_hint: string | null;
  current_price: number | null;
  last_checked_at: string | null;
  check_count: number | null;
  pnl_pct: number | null;
  pnl_per_share: number | null;
  max_favorable_price: number | null;
  max_adverse_price: number | null;
  mfe_pct: number | null;
  mae_pct: number | null;
  stop_dist_pct: number | null;
  sessions_held: number | null;
  last_sma5: number | null;
  last_close: number | null;
  last_eval_date: string | null;
  exit_pending: boolean;
  exit_pending_reason: 'SMA5_EXIT' | 'TIME_EXIT' | null;
  exit_flagged_at: string | null;
  status: string;
  version: string | null;
  stop_used_pct: number | null;
  ui_state: 'RUNNING' | 'EXIT_AT_OPEN' | 'NEAR_TIME_LIMIT';
}

export interface MRSignal {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  option_type: 'CALL' | 'PUT';
  signal_date: string | null;
  state: 'PENDING' | 'FILLED' | 'EXPIRED';
  corr_group: string | null;
  rank: number | null;
  close_price: number | null;
  rsi2: number | null;
  sma5: number | null;
  sma200: number | null;
  st_value: number | null;
  st_dir: 'UP' | 'DOWN' | null;
  atr14: number | null;
  atr_pct: number | null;
  planned_stop: number | null;
  expire_reason: string | null;
  filled_at: string | null;
  position_id: string | null;
  shadow_state: 'WAITING' | 'TRIGGERED' | 'EXPIRED' | null;
}

export interface MRHistoryPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  option_type: 'CALL' | 'PUT';
  corr_group: string | null;
  signal_date: string | null;
  entry_price: number;
  entry_at: string | null;
  stop_loss: number;
  atr14: number | null;
  atr_pct: number | null;
  rsi2_at_signal: number | null;
  sma5_at_signal: number | null;
  sma200_at_signal: number | null;
  suggested_qty: number | null;
  risk_dollars: number | null;
  notional: number | null;
  option_hint: string | null;
  current_price: number | null;
  last_checked_at: string | null;
  check_count: number | null;
  pnl_pct: number | null;
  pnl_per_share: number | null;
  max_favorable_price: number | null;
  max_adverse_price: number | null;
  mfe_pct: number | null;
  mae_pct: number | null;
  stop_dist_pct: number | null;
  sessions_held: number | null;
  last_sma5: number | null;
  last_close: number | null;
  last_eval_date: string | null;
  exit_pending: boolean;
  exit_pending_reason: 'SMA5_EXIT' | 'TIME_EXIT' | null;
  exit_flagged_at: string | null;
  status: 'WIN' | 'LOSS' | 'MANUAL_CLOSE';
  version: string | null;
  stop_used_pct: number | null;
  ui_state: string | null;
  close_reason: 'SMA5_EXIT' | 'TIME_EXIT' | 'STOP_LOSS' | 'MANUAL' | null;
  exit_price: number | null;
  closed_at: string | null;
}

export interface MRScorecard {
  engine: 'MR_LIVE' | 'MR_SHADOW_1H' | 'V2_IRON_GATE';
  trades: number | null;
  wins: number | null;
  win_pct: number | null;
  avg_pnl_pct: number | null;
  avg_win_pct: number | null;
  avg_loss_pct: number | null;
  profit_factor: number | null;
  total_pnl_pct: number | null;
  last_close: string | null;
}

export interface MRPromotion {
  engine: string;
  trades: number | null;
  win_pct: number | null;
  profit_factor: number | null;
  meets_promotion_bar: boolean;
}

export interface MRWeekly {
  week: string;
  trades: number | null;
  win_pct: number | null;
  total_pnl_pct: number | null;
}

export interface MRScanRun {
  scan_id: string;
  ran_at: string;
  bar_date: string | null;
  symbols_ok: number | null;
  symbols_failed: number | null;
  new_signals: number | null;
  exits_flagged: number | null;
  expired: number | null;
  notes: {
    mode?: string;
    today_close?: string;
    preview_candidates?: any[];
    rejected?: any[];
    warmup?: any[];
    errors?: any[];
  } | null;
}

export interface MRShadow {
  variant: string | null;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  entry_at: string | null;
  stop_loss: number;
  current_price: number | null;
  pnl_pct: number | null;
  mfe_pct: number | null;
  mae_pct: number | null;
  status: string | null;
  close_reason: string | null;
  exit_price: number | null;
  closed_at: string | null;
}

export interface MRSkip {
  created_at: string;
  workflow: string | null;
  symbol: string;
  side: 'LONG' | 'SHORT';
  reason: string;
  detail: string | null;
}

export type MRSubTab = 'open' | 'entering' | 'history' | 'shadow' | 'scorecard' | 'skips';

export type Toast = {
  id: string;
  message: string;
  type: 'win' | 'loss' | 'new' | 'info';
};

export type ConnectionStatus = 'connected' | 'idle' | 'disconnected';
