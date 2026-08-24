export type TradeStatus = 'OPEN' | 'WIN' | 'LOSS' | 'MANUAL_CLOSE';
export type OrderStatus = 'submitted' | 'error' | 'dry_run' | 'seed';

export interface OptionDipTrade {
  id: string;
  symbol: string;
  buy_signaled_at: string;

  // dip plan snapshot (underlying)
  underlying_entry: number | null;
  dip_stop: number | null;
  t1_target: number | null;
  t2_target: number | null;
  swing_high: number | null;
  swing_low: number | null;
  dip_low: number | null;
  retrace_pct: number | null;
  confluence: number | null;
  rr_t1: number | null;

  // contract
  contract_symbol: string | null;
  strike: number | null;
  expiry: string | null;
  dte: number | null;
  delta: number | null;
  contract_iv: number | null;
  hv20: number | null;
  iv_hv_ratio: number | null;
  bid: number | null;
  ask: number | null;
  spread_pct: number | null;
  open_interest: number | null;
  limit_price: number | null;
  quantity: number | null;
  total_cost: number | null;
  tp_option_price: number | null;

  // lifecycle
  broker: string;
  order_id: string | null;
  order_status: OrderStatus;
  order_error: string | null;
  status: TradeStatus | null;
  close_reason: string | null;
  exit_underlying: number | null;
  submitted_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DipLifecycle {
  symbol: string;
  dip_state: 'WATCHING' | 'NO_UPTREND' | 'DIP_WATCH' | 'DIP_READY' | 'DIP_BUY' | 'DIP_FAILED';
  price: number | null;
  price_as_of: string | null;
  data_stale: boolean;
  trend_4h: 'UP' | 'DOWN' | 'UNKNOWN';
}

export interface OptionDipSkip {
  id: string;
  symbol: string;
  reason: string;
  context: Record<string, unknown>;
  created_at: string;
}

// Enriched trade with live data joined
export interface EnrichedTrade extends OptionDipTrade {
  live_price: number | null;
  price_as_of: string | null;
  data_stale: boolean;
  live_dte: number | null;
}
