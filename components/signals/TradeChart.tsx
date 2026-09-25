/**
 * TradeChart — candles + 5 labelled price levels. Nothing else.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesType,
} from 'lightweight-charts';
import type { Bar } from '../../lib/supertrend';
import type { Timeframe } from '../../hooks/useMdBars';

export interface TradeChartProps {
  bars: Bar[];
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  currentPrice: number;
  optionType: 'CALL' | 'PUT';
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}

const BG = '#0b0e15';
const GRID = '#161c28';
const TEXT = '#8b93a7';
const ENTRY_COLOR = '#facc15';
const T1_COLOR = '#22c55e';
const T2_COLOR = '#16a34a';
const SL_COLOR = '#ef4444';
const SL_LOCKED_COLOR = '#22c55e';
const MONO = "'JetBrains Mono', monospace";

const TF_OPTIONS: Timeframe[] = ['5min', '15min', '1h', '4h', '1D'];
const TF_LABELS: Record<Timeframe, string> = {
  '5min': '5m', '15min': '15m', '1h': '1h', '4h': '4h', '1D': '1D',
};

interface LevelLabel {
  key: string;
  price: number;
  label: string;
  color: string;
  showPct: boolean;
}

const TradeChart: React.FC<TradeChartProps> = (props) => {
  const { bars, entryPrice, stopLoss, target1, target2, currentPrice, optionType, tf, onTfChange } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const isCall = optionType === 'CALL';
  const stopLocked = isCall ? stopLoss > entryPrice : stopLoss < entryPrice;

  // Position labels using priceToCoordinate
  const positionLabels = useCallback(() => {
    const series = seriesRef.current;
    const overlay = labelsRef.current;
    if (!series || !overlay) return;

    const slColor = stopLocked ? SL_LOCKED_COLOR : SL_COLOR;
    const slLabel = stopLocked ? 'Stop (locked)' : 'Stop loss';

    const levels: LevelLabel[] = [];
    if (target2 != null) levels.push({ key: 't2', price: target2, label: 'Target 2', color: T2_COLOR, showPct: true });
    levels.push({ key: 't1', price: target1, label: 'Target 1', color: T1_COLOR, showPct: true });
    levels.push({ key: 'entry', price: entryPrice, label: 'Entry', color: ENTRY_COLOR, showPct: false });
    levels.push({ key: 'sl', price: stopLoss, label: slLabel, color: slColor, showPct: true });

    // Compute pixel positions
    const items: { key: string; y: number; html: string; color: string; isEntry: boolean }[] = [];
    for (const lv of levels) {
      const y = series.priceToCoordinate(lv.price);
      if (y == null) continue;
      const pct = lv.showPct ? ` · ${((lv.price - currentPrice) / currentPrice * 100) >= 0 ? '+' : ''}${((lv.price - currentPrice) / currentPrice * 100).toFixed(2)}%` : '';
      const text = lv.key === 'entry' ? `${lv.label} ${lv.price.toFixed(2)}` : `${lv.label} ${lv.price.toFixed(2)}${pct}`;
      items.push({ key: lv.key, y: y as number, html: text, color: lv.color, isEntry: lv.key === 'entry' });
    }

    // Overlap resolution: push labels that are < 20px apart
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 20) {
        items[i].y = items[i - 1].y + 20;
      }
    }

    // Render
    overlay.innerHTML = '';
    for (const item of items) {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:4px;top:${item.isEntry ? item.y + 4 : item.y - 12}px;background:${BG};border:1px solid ${item.color};color:${item.color};font-size:11px;font-family:${MONO};font-weight:600;border-radius:3px;padding:1px 6px;pointer-events:none;white-space:nowrap;z-index:5;line-height:16px;`;
      el.textContent = item.html;
      overlay.appendChild(el);
    }
  }, [entryPrice, stopLoss, target1, target2, currentPrice, stopLocked]);

  // Escape to close fullscreen
  useEffect(() => {
    if (!isFullScreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullScreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullScreen]);

  // Chart rendering
  useEffect(() => {
    if (!containerRef.current || bars.length < 2) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const el = containerRef.current;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 280,
      layout: {
        background: { color: BG },
        textColor: TEXT,
        fontSize: 11,
        fontFamily: MONO,
        attributionLogo: false,
      } as any,
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(139,147,167,0.2)', labelBackgroundColor: '#1a1f2e' },
        horzLine: { color: 'rgba(139,147,167,0.2)', labelBackgroundColor: '#1a1f2e' },
      },
      rightPriceScale: {
        borderColor: GRID,
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: tf !== '4h' && tf !== '1D',
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // Candle series
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceLineVisible: false,
    });

    // Build candle data, updating last bar if currentPrice is newer
    const candleData = bars.map((b, i) => ({
      time: b.time as Time,
      open: b.open,
      high: i === bars.length - 1 ? Math.max(b.high, currentPrice) : b.high,
      low: i === bars.length - 1 ? Math.min(b.low, currentPrice) : b.low,
      close: i === bars.length - 1 ? currentPrice : b.close,
    }));
    series.setData(candleData);
    seriesRef.current = series;

    // "Now" tag — use a hidden price line to show only the axis label
    series.createPriceLine({
      price: currentPrice,
      lineVisible: false,
      axisLabelVisible: true,
      axisLabelColor: '#ffffff',
      axisLabelTextColor: '#0b0e15',
      title: '',
      lineWidth: 1,
      color: 'transparent',
    } as any);

    // Price lines (visible horizontal lines, no axis labels)
    const slColor = stopLocked ? SL_LOCKED_COLOR : SL_COLOR;

    if (target2 != null) {
      series.createPriceLine({
        price: target2, color: T2_COLOR, lineWidth: 2, lineStyle: 1,
        axisLabelVisible: false, title: '',
      });
    }
    series.createPriceLine({
      price: target1, color: T1_COLOR, lineWidth: 2, lineStyle: 0,
      axisLabelVisible: false, title: '',
    });
    series.createPriceLine({
      price: entryPrice, color: ENTRY_COLOR, lineWidth: 2, lineStyle: 0,
      axisLabelVisible: false, title: '',
    });
    series.createPriceLine({
      price: stopLoss, color: slColor, lineWidth: 2, lineStyle: 0,
      axisLabelVisible: false, title: '',
    });

    // Autoscale: ensure all levels visible with 5% padding
    const allPrices = [entryPrice, stopLoss, target1, currentPrice];
    if (target2 != null) allPrices.push(target2);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const pad = (maxP - minP) * 0.05;
    const totalRange = maxP - minP + 2 * pad;
    const topMargin = (maxP + pad - Math.max(...bars.map(b => b.high))) / totalRange;
    const botMargin = (Math.min(...bars.map(b => b.low)) - (minP - pad)) / totalRange;
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: Math.max(0.02, Math.min(0.3, -topMargin + 0.05)),
        bottom: Math.max(0.02, Math.min(0.3, -botMargin + 0.05)),
      },
      autoScale: true,
    });

    chart.timeScale().fitContent();
    positionLabels();

    // Reposition labels on scroll/zoom/resize
    const onRangeChange = () => positionLabels();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width });
        if (isFullScreen) chart.applyOptions({ height: e.contentRect.height });
      }
      positionLabels();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, entryPrice, stopLoss, target1, target2, currentPrice, stopLocked, tf, isFullScreen, positionLabels]);

  if (bars.length < 2) {
    return (
      <div style={{ background: BG, borderRadius: 12, padding: '32px 16px', textAlign: 'center', color: TEXT, fontSize: 12 }}>
        Waiting for chart data...
      </div>
    );
  }

  const toolbar = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 8px', background: BG,
    }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {TF_OPTIONS.map(t => (
          <button key={t} onClick={() => onTfChange(t)} style={{
            padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 800, fontFamily: MONO,
            background: tf === t ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: tf === t ? '#fff' : TEXT,
          }}>
            {TF_LABELS[t]}
          </button>
        ))}
      </div>
      <button
        onClick={() => setIsFullScreen(v => !v)}
        aria-label="Full screen"
        style={{
          padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
          fontSize: 13, color: TEXT, background: 'transparent',
        }}
      >
        {isFullScreen ? '✕' : '\u2922'}
      </button>
    </div>
  );

  // Fullscreen overlay
  if (isFullScreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: BG, display: 'flex', flexDirection: 'column',
      }}>
        {toolbar}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          <div ref={labelsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        </div>
      </div>
    );
  }

  // Card mode
  return (
    <div style={{ background: BG, borderRadius: 12, overflow: 'hidden' }}>
      {toolbar}
      <div style={{ position: 'relative', height: 280 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <div ref={labelsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  );
};

export default TradeChart;
