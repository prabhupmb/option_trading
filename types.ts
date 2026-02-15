
export enum SignalType {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  WEAK_BUY = 'WEAK_BUY',
  STRONG_SELL = 'STRONG_SELL',
  SELL = 'SELL',
  WEAK_SELL = 'WEAK_SELL',
  NO_TRADE = 'NO_TRADE',
  NEUTRAL = 'NEUTRAL'
}

export interface StockSignal {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  conviction: number;
  status: 'READY' | 'ANALYZING' | 'RESCAN';
  matrix: {
    '4H': 'UP' | 'DOWN' | 'NEUTRAL';
    '1H': 'UP' | 'DOWN' | 'NEUTRAL';
    '15M': 'UP' | 'DOWN' | 'NEUTRAL';
  };
  icon: string;
  analysis?: string;
  // New fields from Google Sheets
  signal?: string;
  optionType?: string;
  tier?: string;
  gatesPassed?: string;
  tradingRecommendation?: string;
  tradeReason?: string;
  adxValue?: number;
  adxTrend?: string;
  timestamp?: string;
}

export interface SummaryStat {
  type: SignalType;
  count: number;
  change: number;
}

export type UserRole = 'admin' | 'customer';
export type AccessLevel = 'signal' | 'paper' | 'trade';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  user_name?: string;
  username?: string;
  role: UserRole;
  access_level: AccessLevel;
  is_active: boolean;
  created_at?: string;
}

export type BrokerName = 'alpaca' | 'schwab' | 'ibkr';
export type BrokerMode = 'paper' | 'live';

export interface BrokerCredential {
  id: string;
  user_id: string;
  broker_name: BrokerName;
  display_name: string;
  broker_mode: BrokerMode;
  is_active: boolean;
  is_default: boolean;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  account_id?: string;
  base_url?: string;
  settings?: any;
  created_at?: string;
  updated_at?: string;
}

export interface OptionSignal {
  id: string;
  symbol: string;
  current_price: number;
  option_type: 'CALL' | 'PUT' | 'NO_TRADE';
  tier: 'A+' | 'A' | 'B+' | 'NO_TRADE';
  trading_recommendation: string;
  gates_passed: string;
  adx_value: number;
  adx_trend: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NO_TREND';
  sma_direction?: 'UP' | 'DOWN' | 'Neutral';
  fib_target1: number;
  fib_target2: number;
  fib_stop_loss: number;
  risk_reward_ratio: string;
  analyzed_at: string;
}
