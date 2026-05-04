export const C = {
  pageBg: '#0D1414',
  cardBg: '#131C1C',
  cardBorder: '#1F2A2A',
  cardBorderHover: '#2A3838',
  innerRowBg: '#182222',
  textPrimary: '#E0F0E0',
  textSecondary: '#7A8C8C',
  textMuted: '#4A5959',
  accentGreen: '#22C55E',
  accentYellow: '#FFD700',
  accentRed: '#EF4444',
  buyColor: '#22C55E',
  strongBuyColor: '#16A34A',
  sellColor: '#EF4444',
  strongSellColor: '#DC2626',
  tierAPlus: '#FFD700',
  tierA: '#22C55E',
  tierB: '#6B7280',
  blue: '#3B82F6',
} as const;

// Scan times in ET (HH:MM 24h)
export const SCAN_TIMES_ET: string[] = [
  '09:35', '09:50', '10:05', '10:20', '10:35',
  '11:05', '11:20', '11:35', '11:50',
  '12:05', '12:20', '12:35', '12:50',
  '13:05', '13:20', '13:35', '13:50',
  '14:05', '14:20', '14:35', '14:50',
  '15:05', '15:20', '15:35', '15:50',
];

export const MARKET_OPEN_HOUR_ET = 9;
export const MARKET_OPEN_MIN_ET = 30;
export const MARKET_CLOSE_HOUR_ET = 16;
export const MARKET_CLOSE_MIN_ET = 0;
