export interface BrokerRef { brokerId: string; displayName: string; brokerName: 'schwab'|'alpaca'; brokerMode: 'live'|'paper' }
export interface StatBlock { pnl: number|null; trades: number; wins: number; losses: number; winRate: number|null; avgWin: number|null; avgLoss: number|null; profitFactor: number|null; expectancy: number|null; avgR: number|null }
export interface Trade {
  id: string; tripKey: string; brokerId: string; brokerName: string; brokerMode: string;
  symbol: string; underlying: string; assetType: 'EQUITY'|'OPTION'; putCall: 'CALL'|'PUT'|null; strike: number|null; expirationDate: string|null;
  direction: 'LONG'|'SHORT'; qty: number; closedQty: number; multiplier: number;
  entryPrice: number|null; entryAt: string; exitPrice: number|null; exitAt: string|null;
  status: 'OPEN'|'WIN'|'LOSS'|'MANUAL_CLOSE';
  closeReason: 'TAKE_PROFIT'|'STOP_LOSS'|'MARKET_EXIT'|'LIMIT_EXIT'|'EXPIRED'|null;
  realizedPL: number|null; realizedPLPct: number|null; rMultiple: number|null; holdMinutes: number|null;
  currentPrice: number|null; unrealizedPL: number|null; needsReview: boolean;
  source: 'stock_gate'|'option_auto_trade'|'manual'|string|null; signalTier: string|null;
  plannedEntry: number|null; plannedTP: number|null; plannedSL: number|null; plannedRR: number|null;
}
export interface Position { brokerId: string; symbol: string; underlying: string; assetType: 'EQUITY'|'OPTION'; putCall: string|null; strike: number|null; expirationDate: string|null; quantity: number; avgPrice: number; currentPrice: number|null; marketValue: number; unrealizedPL: number|null; unrealizedPLPct: number|null; dayPL: number|null; openedAt: string|null; source: string|null; plannedTP: number|null; plannedSL: number|null }
export interface Order { brokerId: string; orderId: string; parentOrderId: string|null; symbol: string; underlying: string; assetType: string; instruction: string; side: 'BUY'|'SELL'; orderType: string; legRole: 'ENTRY'|'TAKE_PROFIT'|'STOP_LOSS'|null; quantity: number; filledQty: number; limitPrice: number|null; stopPrice: number|null; fillPrice: number|null; status: string; statusDescription: string|null; enteredAt: string; closedAt: string|null }
export interface FeedEvent { type: string; tone: 'info'|'win'|'loss'|'warn'; symbol: string; assetType: string; price: number|null; pnl?: number; at: string; message: string }
export interface MissedTrade { decidedAt: string; symbol: string; side: 'LONG'|'SHORT'; decision: string; reason: string|null; regime: string|null; confidence: number|null; entry: number|null; stop: number|null; target: number|null; rr: number|null }
export interface GroupStat extends StatBlock { }
export interface SchwabDetails { broker: 'schwab'; accountType: 'CASH'|'MARGIN'|string; roundTrips: number|null; isDayTrader: boolean|null; closingOnlyRestricted: boolean|null; cashAvailableForTrading: number|null; cashAvailableForWithdrawal: number|null; unsettledCash: number|null; cashCall: number|null; longStockValue: number|null; longOptionValue: number|null; shortOptionValue: number|null; marginBalance: number|null; maintenanceRequirement: number|null }
export interface AlpacaDetails { broker: 'alpaca'; status: string|null; patternDayTrader: boolean|null; daytradeCount: number|null; tradingBlocked: boolean|null; accountBlocked: boolean|null; shortingEnabled: boolean|null; marginMultiplier: number|null; daytradingBuyingPower: number|null; regtBuyingPower: number|null; nonMarginableBuyingPower: number|null; optionsLevel: number|null; optionsBuyingPower: number|null; longMarketValue: number|null; shortMarketValue: number|null }
export interface PortfolioPayload {
  success: true;
  broker: { brokerId: string; displayName: string; brokerName: 'schwab'|'alpaca'; brokerMode: 'live'|'paper'; accountType: string|null; details: SchwabDetails|AlpacaDetails|null } | null;
  scope: { label: string; selected: string; brokers: BrokerRef[]; availableBrokers: BrokerRef[] };
  sync: { lastSyncedAt: string|null; ageSeconds: number|null; stale: boolean; marketOpen: boolean; errors: Array<{ brokerId: string; displayName: string; status: 'ERROR'|'AUTH_EXPIRED'; error: string|null }> };
  account: { totalEquity: number; cashBalance: number; buyingPower: number; dayPL: number; dayPLPct: number; unrealizedPL: number;
             openPositions: { total: number; options: number; stocks: number }; orders7d: { total: number; filled: number; pending: number; rejected: number } };
  periods: { week: StatBlock; month: StatBlock; year: StatBlock; allTime: StatBlock };
  equityCurve: Array<{ date: string; equity: number }>;
  monthly: Array<StatBlock & { month: string; year: number; monthNum: number }>;
  daily: Array<{ date: string; pnl: number; trades: number; wins: number; losses: number; cumulativePnl: number }>;
  highlights: { bestThisMonth: HL|null; worstThisMonth: HL|null };
  bySymbol: Array<StatBlock & { symbol: string }>;
  bySource: Array<StatBlock & { source: string }>;
  byCloseReason: Array<StatBlock & { reason: string }>;
  positions: Position[]; orders: Order[]; openTrades: Trade[]; trades: Trade[]; events: FeedEvent[]; missed: MissedTrade[];
  timestamp: string;
}
export interface HL { symbol: string; pnl: number; direction: 'LONG'|'SHORT'; qty: number; assetType: string; exitAt: string; closeReason: string|null }
