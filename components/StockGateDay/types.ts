export interface StockGateDayPosition {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  signal_type: string;
  tier: 'A+' | 'A' | 'B';
  gate_score: number;
  signal: string;
  trading_recommendation: string;
  entry_price: number;
  target_1: number;
  target_2: number;
  stop_loss: number;
  current_price: number | null;
  risk_reward_ratio: number;
  adx_value: number;
  plus_di: number;
  minus_di: number;
  vwap_value: number;
  vwap_position: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  vwap_crossed: boolean;
  vwap_cross_dir: 'UP' | 'DOWN' | 'NONE' | null;
  supertrend_5m: 'BULLISH' | 'BEARISH';
  volume_ratio: number | null;
  pnl_pct: number;
  pnl_dollars: number;
  progress_pct: number;
  high_water_mark: number;
  low_water_mark: number;
  check_count: number;
  status: 'OPEN';
  source: string;
  version: string;
  opened_at: string;
  last_checked_at: string | null;
  // Stock-specific fields
  stage_2: boolean | null;
  sector: string | null;
  market_cap: string | null;
  float_shares: number | null;
  gap_pct: number | null;
  premarket_volume: number | null;
}

export interface StockGateDayHistory {
  id: string;
  position_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  tier: 'A+' | 'A' | 'B';
  gate_score: number;
  entry_price: number;
  exit_price: number;
  target_1: number;
  target_2: number;
  stop_loss: number;
  exit_reason: 'TARGET_HIT' | 'STOP_LOSS' | 'EOD' | 'ST_1H_FLIP' | 'STALE_8H';
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnl_pct: number;
  pnl_dollars: number;
  duration_minutes: number;
  check_count: number;
  high_water_mark: number;
  low_water_mark: number;
  final_progress: number;
  adx_value: number;
  vwap_value: number;
  volume_ratio: number;
  source: string;
  version: string;
  opened_at: string;
  closed_at: string;
  // Stock-specific
  stage_2: boolean | null;
  sector: string | null;
}

export type SignalFilter = 'ALL' | 'STRONG_BUY' | 'BUY' | 'STRONG_SELL' | 'SELL';
export type ActiveTab = 'positions' | 'history';
export type ConnectionStatus = 'connected' | 'idle' | 'disconnected';

export interface Toast {
  id: string;
  message: string;
  type: 'win' | 'loss' | 'new' | 'info';
}
