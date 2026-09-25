/**
 * TradeChart — Full TradingView-style chart for Iron Gate position cards.
 * Replaces the old MiniSuperTrendChart + PriceLadder + metrics strip + progress bar.
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type SeriesMarker,
  type Time,
  type SeriesType,
} from 'lightweight-charts';
import {
  computeSuperTrend,
  buildHeikinAshi,
  computeVWAP,
  type Bar,
} from '../../lib/supertrend';
import { TradePlanPlugin } from './TradePlanPlugin';
import type { Timeframe } from '../../hooks/useMdBars';

// ─── Types ──────────────────────────────────────────────────

export interface TradeChartProps {
  symbol: string;
  bars: Bar[];
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  originalStopLoss?: number;
  currentPrice: number;
  highWaterMark?: number;      // progress % (0-100)
  riskRewardRatio?: string | number;
  progressPct?: number;
  adxValue?: number;
  plusDi?: number;
  minusDi?: number;
  gatesPassed?: string | number;
  optionType: 'CALL' | 'PUT';
  openedAt?: string;
  showVwap?: boolean;          // true for Day cards
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}

// ─── Constants ──────────────────────────────────────────────

const BG = '#0b0e15';
const GRID = '#161c28';
const TEXT = '#8b93a7';
const ENTRY_COLOR = '#facc15';
const T1_COLOR = '#22c55e';
const SL_COLOR = '#ef4444';
const VWAP_COLOR = '#a78bfa';
const CURRENT_UP = '#22c55e';
const CURRENT_DN = '#ef4444';

const TF_OPTIONS: Timeframe[] = ['5min', '15min', '1h', '4h', '1D'];
const TF_LABELS: Record<Timeframe, string> = {
  '5min': '5m',
  '15min': '15m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1D',
};

type ChartStyle = 'candles' | 'line';
type STSource = 'regular' | 'ha';

// ─── Component ──────────────────────────────────────────────

const TradeChart: React.FC<TradeChartProps> = ({
  symbol, bars, entryPrice, stopLoss, target1, target2, originalStopLoss,
  currentPrice, highWaterMark, riskRewardRatio, progressPct, adxValue,
  plusDi, minusDi, gatesPassed, optionType, openedAt, showVwap, tf, onTfChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [stSource, setStSource] = useState<STSource>('regular');

  const isCall = optionType === 'CALL';
  const isProfitable = isCall
    ? currentPrice >= entryPrice
    : currentPrice <= entryPrice;

  // Compute SuperTrend
  const stOutput = useMemo(() => {
    const source = stSource === 'ha' ? buildHeikinAshi(bars) : bars;
    return computeSuperTrend(source, 10, 3);
  }, [bars, stSource]);

  // Compute VWAP (for intraday Day cards)
  const vwapData = useMemo(() => {
    if (!showVwap || tf === '1D') return [];
    return computeVWAP(bars);
  }, [bars, showVwap, tf]);

  // Current ST info
  const currentST = stOutput.values.length > 0
    ? stOutput.values[stOutput.values.length - 1]
    : null;
  const stAgainstTrade = (isCall && currentST?.trend === -1) ||
    (!isCall && currentST?.trend === 1);

  // HWM price (reconstruct from progress %)
  const hwmPrice = useMemo(() => {
    if (highWaterMark == null || highWaterMark <= 0) return null;
    if (isCall) {
      return stopLoss + (highWaterMark / 100) * (target1 - stopLoss);
    } else {
      return stopLoss - (highWaterMark / 100) * (stopLoss - target1);
    }
  }, [highWaterMark, isCall, stopLoss, target1]);

  // ── Chart rendering ──
  useEffect(() => {
    if (!containerRef.current || bars.length < 2) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 340,
      layout: {
        background: { color: BG },
        textColor: TEXT,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
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
        scaleMargins: { top: 0.05, bottom: 0.22 },
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // ── Volume histogram (bottom pane via priceScaleId) ──
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: 'rgba(139,147,167,0.15)',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    const volData: HistogramData<Time>[] = bars.map(b => ({
      time: b.time as Time,
      value: b.volume ?? 0,
      color: b.close >= b.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
    }));
    volSeries.setData(volData);

    // ── Main series: Candles or Line ──
    let mainSeries: ISeriesApi<SeriesType, Time>;
    if (chartStyle === 'candles') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: '#00c853',
        downColor: '#ff5252',
        borderUpColor: '#00c853',
        borderDownColor: '#ff5252',
        wickUpColor: 'rgba(0,200,83,0.5)',
        wickDownColor: 'rgba(255,82,82,0.5)',
      });
      const candleData: CandlestickData<Time>[] = bars.map(b => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));
      s.setData(candleData);
      mainSeries = s;
    } else {
      const s = chart.addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 2,
        crosshairMarkerVisible: true,
      });
      const lineData: LineData<Time>[] = bars.map(b => ({
        time: b.time as Time,
        value: b.close,
      }));
      s.setData(lineData);
      mainSeries = s;
    }

    // ── Trade Plan overlay (rectangles) ──
    const plugin = new TradePlanPlugin({
      entry: entryPrice,
      target: target1,
      stopLoss,
    });
    mainSeries.attachPrimitive(plugin as any);

    // ── SuperTrend overlay ──
    if (stOutput.values.length > 0) {
      const greenLine: LineData<Time>[] = [];
      const redLine: LineData<Time>[] = [];
      let prevTrend: number | null = null;

      for (const v of stOutput.values) {
        const point: LineData<Time> = { time: v.time as Time, value: v.st };
        if (v.trend === 1) {
          greenLine.push(point);
          redLine.push(prevTrend === -1 ? point : { time: v.time as Time, value: NaN });
        } else {
          redLine.push(point);
          greenLine.push(prevTrend === 1 ? point : { time: v.time as Time, value: NaN });
        }
        prevTrend = v.trend;
      }

      const gSeries = chart.addSeries(LineSeries, {
        color: '#00c853',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      gSeries.setData(greenLine);

      const rSeries = chart.addSeries(LineSeries, {
        color: '#ff5252',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      rSeries.setData(redLine);
    }

    // ── VWAP overlay ──
    if (vwapData.length > 0) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color: VWAP_COLOR,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      vwapSeries.setData(
        vwapData.map(v => ({ time: v.time as Time, value: v.value }))
      );
    }

    // ── Price lines ──
    mainSeries.createPriceLine({
      price: entryPrice,
      color: ENTRY_COLOR,
      lineWidth: 1,
      lineStyle: 2, // dashed
      axisLabelVisible: true,
      title: 'Entry',
    });

    mainSeries.createPriceLine({
      price: target1,
      color: T1_COLOR,
      lineWidth: 1,
      lineStyle: 0, // solid
      axisLabelVisible: true,
      title: 'T1',
    });

    if (target2 && target2 !== target1) {
      mainSeries.createPriceLine({
        price: target2,
        color: T1_COLOR,
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: true,
        title: 'T2',
      });
    }

    mainSeries.createPriceLine({
      price: stopLoss,
      color: SL_COLOR,
      lineWidth: 1,
      lineStyle: 0, // solid
      axisLabelVisible: true,
      title: 'SL',
    });

    if (originalStopLoss && originalStopLoss !== stopLoss) {
      mainSeries.createPriceLine({
        price: originalStopLoss,
        color: 'rgba(239,68,68,0.3)',
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: false,
        title: 'Orig SL',
      });
    }

    // Current price line
    mainSeries.createPriceLine({
      price: currentPrice,
      color: isProfitable ? CURRENT_UP : CURRENT_DN,
      lineWidth: 1,
      lineStyle: 0,
      axisLabelVisible: true,
      title: '',
    });

    // HWM tick
    if (hwmPrice) {
      mainSeries.createPriceLine({
        price: hwmPrice,
        color: 'rgba(250,204,21,0.4)',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: false,
        title: 'HWM',
      });
    }

    // ── Entry marker ──
    if (openedAt && bars.length > 0) {
      const openedTime = new Date(openedAt).getTime() / 1000;
      // Find closest bar
      let closestIdx = 0;
      let closestDiff = Infinity;
      for (let i = 0; i < bars.length; i++) {
        const diff = Math.abs(bars[i].time - openedTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = i;
        }
      }
      if (closestDiff < 86400 * 5) { // within 5 days
        const markers: SeriesMarker<Time>[] = [{
          time: bars[closestIdx].time as Time,
          position: isCall ? 'belowBar' : 'aboveBar',
          color: ENTRY_COLOR,
          shape: isCall ? 'arrowUp' : 'arrowDown',
          text: isCall ? 'CALL' : 'PUT',
        }];
        createSeriesMarkers(mainSeries, markers);
      }
    }

    chart.timeScale().fitContent();

    // Resize observer
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, stOutput, vwapData, chartStyle, entryPrice, stopLoss, target1, target2,
    originalStopLoss, currentPrice, isProfitable, hwmPrice, openedAt, isCall]);

  // ── Empty state ──
  if (bars.length < 2) {
    return (
      <div style={{
        background: BG,
        borderRadius: 12,
        padding: '32px 16px',
        textAlign: 'center',
        color: TEXT,
        fontSize: 12,
      }}>
        Waiting for chart data...
      </div>
    );
  }

  const rrDisplay = typeof riskRewardRatio === 'number'
    ? `1:${riskRewardRatio.toFixed(1)}`
    : riskRewardRatio || '-';

  return (
    <div style={{ background: BG, borderRadius: 12, overflow: 'hidden' }}>
      {/* ── Toolbar: TF picker + Style toggles ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: `1px solid ${GRID}`,
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {/* TF buttons */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TF_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => onTfChange(t)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
                fontFamily: "'JetBrains Mono', monospace",
                background: tf === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tf === t ? '#fff' : TEXT,
                transition: 'all 0.15s',
              }}
            >
              {TF_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Style + ST source toggles */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['candles', 'line'] as const).map(s => (
              <button
                key={s}
                onClick={() => setChartStyle(s)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: chartStyle === s ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: chartStyle === s ? '#fff' : TEXT,
                  transition: 'all 0.15s',
                }}
              >
                {s === 'candles' ? 'Candles' : 'Line'}
              </button>
            ))}
          </div>
          <div style={{ width: 1, background: GRID, margin: '2px 0' }} />
          <div style={{ display: 'flex', gap: 2 }}>
            {(['regular', 'ha'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStSource(s)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: stSource === s ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: stSource === s ? '#fff' : TEXT,
                  transition: 'all 0.15s',
                }}
              >
                {s === 'regular' ? 'Regular' : 'H-Ashi'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend overlay ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '6px 10px',
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        color: TEXT,
        borderBottom: `1px solid ${GRID}`,
        alignItems: 'center',
      }}>
        {/* ST info */}
        {currentST && (
          <span style={{ color: currentST.trend === 1 ? '#00c853' : '#ff5252' }}>
            ST {currentST.st.toFixed(2)}
          </span>
        )}
        {stAgainstTrade && (
          <span style={{
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 9,
            background: 'rgba(245,158,11,0.12)',
            color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.25)',
          }}>
            ST AGAINST
          </span>
        )}
        <span style={{ color: TEXT }}>R:R {rrDisplay}</span>
        {progressPct != null && (
          <span style={{ color: progressPct >= 50 ? '#00c853' : TEXT }}>
            {progressPct.toFixed(0)}%
          </span>
        )}
        {adxValue != null && (
          <span style={{ color: adxValue >= 25 ? '#00c853' : adxValue >= 20 ? '#f59e0b' : TEXT }}>
            ADX {adxValue.toFixed(0)}
          </span>
        )}
        {plusDi != null && minusDi != null && (
          <span style={{ color: plusDi > minusDi ? '#00c853' : '#ff5252' }}>
            {plusDi > minusDi ? '+' : '-'}DI {Math.abs(plusDi - minusDi).toFixed(0)}
          </span>
        )}
        {gatesPassed != null && (
          <span style={{ color: TEXT }}>
            Gates {typeof gatesPassed === 'number' ? `${gatesPassed}/6` : gatesPassed}
          </span>
        )}
        {showVwap && vwapData.length > 0 && (
          <span style={{ color: VWAP_COLOR }}>
            VWAP {vwapData[vwapData.length - 1].value.toFixed(2)}
          </span>
        )}
      </div>

      {/* ── Chart container ── */}
      <div ref={containerRef} />
    </div>
  );
};

export default TradeChart;
