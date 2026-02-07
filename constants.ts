
import { SignalType, StockSignal, SummaryStat } from './types';

export const SUMMARY_STATS: SummaryStat[] = [
  { type: SignalType.STRONG_BUY, count: 12, change: 15 },
  { type: SignalType.BUY, count: 24, change: 8 },
  { type: SignalType.SELL, count: 5, change: -2 },
];

export const INITIAL_SIGNALS: StockSignal[] = [
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    price: 175.20,
    changePercent: 1.24,
    conviction: 95,
    status: 'READY',
    matrix: { '4H': 'UP', '1H': 'UP', '15M': 'NEUTRAL' },
    icon: 'electric_car'
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    price: 882.15,
    changePercent: 2.85,
    conviction: 0,
    status: 'ANALYZING',
    matrix: { '4H': 'NEUTRAL', '1H': 'NEUTRAL', '15M': 'NEUTRAL' },
    icon: 'memory'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 169.30,
    changePercent: -0.45,
    conviction: 42,
    status: 'RESCAN',
    matrix: { '4H': 'DOWN', '1H': 'DOWN', '15M': 'NEUTRAL' },
    icon: 'shopping_basket'
  }
];
