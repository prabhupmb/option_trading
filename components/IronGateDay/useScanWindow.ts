import { useEffect, useState } from 'react';
import { SCAN_TIMES_ET } from './constants';

export interface ScanWindowResult {
  scanTimes: string[];
  nextScan: string | null;       // "10:35"
  countdown: string;             // "4:32"
  countdownSeconds: number;
  statusOf: (t: string) => 'past' | 'next' | 'future';
}

function getETHHMM(): string {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = String(et.getHours()).padStart(2, '0');
  const m = String(et.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getSecondsUntil(hhmm: string): number {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const [h, m] = hhmm.split(':').map(Number);
  const target = new Date(et);
  target.setHours(h, m, 0, 0);
  return Math.max(0, Math.floor((target.getTime() - et.getTime()) / 1000));
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useScanWindow(): ScanWindowResult {
  const [hhmm, setHHMM] = useState(getETHHMM);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHHMM(getETHHMM());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const nextScan = SCAN_TIMES_ET.find(t => t > hhmm) || null;

  useEffect(() => {
    if (!nextScan) { setSeconds(0); return; }
    const update = () => setSeconds(getSecondsUntil(nextScan));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextScan]);

  const statusOf = (t: string): 'past' | 'next' | 'future' => {
    if (t === nextScan) return 'next';
    if (t < hhmm) return 'past';
    return 'future';
  };

  return {
    scanTimes: SCAN_TIMES_ET,
    nextScan,
    countdown: formatCountdown(seconds),
    countdownSeconds: seconds,
    statusOf,
  };
}
