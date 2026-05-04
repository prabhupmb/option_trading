import { useEffect, useState } from 'react';

function isDSTNow(d: Date): boolean {
  const y = d.getUTCFullYear();
  // Second Sunday in March at 2 AM ET = 7 AM UTC
  const marchSecondSunday = new Date(Date.UTC(y, 2, 8, 7));
  marchSecondSunday.setUTCDate(8 + ((7 - marchSecondSunday.getUTCDay()) % 7));
  // First Sunday in November at 2 AM ET = 6 AM UTC
  const novFirstSunday = new Date(Date.UTC(y, 10, 1, 6));
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
  const etOffset = dst ? -4 : -5;

  const utcTotalMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const etTotalMin = ((utcTotalMin + etOffset * 60) % 1440 + 1440) % 1440;

  const etHour = Math.floor(etTotalMin / 60);
  const etMinute = etTotalMin % 60;
  const etSecond = now.getUTCSeconds();

  const isPM = etHour >= 12;
  const displayHour = etHour % 12 === 0 ? 12 : etHour % 12;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted = `${pad(displayHour)}:${pad(etMinute)}:${pad(etSecond)} ${isPM ? 'PM' : 'AM'}`;

  // UTC day-of-week adjusted for ET offset
  const etDayMs = now.getTime() + etOffset * 3600 * 1000;
  const etDow = new Date(etDayMs).getUTCDay();
  const isWeekend = etDow === 0 || etDow === 6;

  const marketOpenMin = 9 * 60 + 30;
  const marketCloseMin = 16 * 60;
  const isMarketOpen = !isWeekend && etTotalMin >= marketOpenMin && etTotalMin < marketCloseMin;

  const etHHMM = `${pad(etHour)}:${pad(etMinute)}`;

  return {
    formatted,
    etHour,
    etMinute,
    etSecond,
    etMinuteOfDay: etTotalMin,
    isMarketOpen,
    isWeekend,
    isDST: dst,
    etHHMM,
  };
}
