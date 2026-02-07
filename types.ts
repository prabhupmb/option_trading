
export enum SignalType {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  SELL = 'SELL',
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
}

export interface SummaryStat {
  type: SignalType;
  count: number;
  change: number;
}
