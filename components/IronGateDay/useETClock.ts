import { useEffect, useState } from 'react';

function isDSTNow(d: Date): boolean {
  const y = d.getUTCFullYear();
  // Second Sunday in March at 2 AM CT = 8 AM UTC
  const marchSecondSunday = new Date(Date.UTC(y, 2, 8, 8));
  marchSecondSunday.setUTCDate(8 + ((7 - marchSecondSunday.getUTCDay()) % 7));
  // First Sunday in November at 2 AM CT = 7 AM UTC
  const novFirstSunday = new Date(Date.UTC(y, 10, 1, 7));
  novFirstSunday.setUTCDate(1 + ((7 - novFirstSunday.getUTCDay()) % 7));
  return d >= marchSecondSunday && d < novFirstSunday;
}

export interface ETClockResult {
  formatted: string;   // "11:04:34 PM"
  etHour: number;
  etMinute: number;
  etSecond: number;
  etMinuteOfDay: number; // hour*60+minute
  isMarketOpen: boolean;
  isWeekend: boolean;
  isDST: boolean;
  etHHMM: string; // "11:04" 24h
}

export function useETClock(): ETClockResult {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dst = isDSTNow(now);
  // CST = UTC-6, CDT = UTC-5
  const cstOffset = dst ? -5 : -6;

  const utcTotalMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const cstTotalMin = ((utcTotalMin + cstOffset * 60) % 1440 + 1440) % 1440;

  const cstHour = Math.floor(cstTotalMin / 60);
  const cstMinute = cstTotalMin % 60;
  const cstSecond = now.getUTCSeconds();

  const isPM = cstHour >= 12;
  const displayHour = cstHour % 12 === 0 ? 12 : cstHour % 12;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted = `${pad(displayHour)}:${pad(cstMinute)}:${pad(cstSecond)} ${isPM ? 'PM' : 'AM'}`;

  // UTC day-of-week adjusted for CST offset
  const cstDayMs = now.getTime() + cstOffset * 3600 * 1000;
  const cstDow = new Date(cstDayMs).getUTCDay();
  const isWeekend = cstDow === 0 || cstDow === 6;

  // Market hours in CST: 8:30 AM – 3:00 PM CST (= 9:30–16:00 ET)
  const marketOpenMin = 8 * 60 + 30;
  const marketCloseMin = 15 * 60;
  const isMarketOpen = !isWeekend && cstTotalMin >= marketOpenMin && cstTotalMin < marketCloseMin;

  const cstHHMM = `${pad(cstHour)}:${pad(cstMinute)}`;

  return {
    formatted,
    etHour: cstHour,
    etMinute: cstMinute,
    etSecond: cstSecond,
    etMinuteOfDay: cstTotalMin,
    isMarketOpen,
    isWeekend,
    isDST: dst,
    etHHMM: cstHHMM,
  };
}
