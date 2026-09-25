import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { computeSuperTrend, buildHeikinAshi, Bar } from '../../lib/supertrend';

interface Props {
  symbol: string;
  bars: Bar[];
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  optionType: 'CALL' | 'PUT' | 'NO_TRADE';
  openedAt?: string;
}

const MiniSuperTrendChart: React.FC<Props> = ({
  symbol, bars, entryPrice, stopLoss, target, optionType, openedAt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [candleSource, setCandleSource] = useState<'regular' | 'ha'>('regular');

  // Compute SuperTrend
  const stOutput = useMemo(() => {
    const source = candleSource === 'ha' ? buildHeikinAshi(bars) : bars;
    return computeSuperTrend(source, 10, 3);
  }, [bars, candleSource]);

  // Current trend info
  const currentST = stOutput.values.length > 0 ? stOutput.values[stOutput.values.length - 1] : null;
  const trendLabel = currentST?.trend === 1 ? 'BULLISH' : currentST?.trend === -1 ? 'BEARISH' : '—';
  const trendColor = currentST?.trend === 1 ? '#00c853' : '#ff5252';
  const stAgainstTrade = (optionType === 'CALL' && currentST?.trend === -1) ||
                         (optionType === 'PUT' && currentST?.trend === 1);

  useEffect(() => {
    if (!containerRef.current || bars.length < 20) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: {
        background: { color: '#0f1219' },
        textColor: '#6b7280',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(255,255,255,0.1)', labelBackgroundColor: '#1a1f2e' },
        horzLine: { color: 'rgba(255,255,255,0.1)', labelBackgroundColor: '#1a1f2e' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // Candlestick series (always show regular candles)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00c853',
      downColor: '#ff5252',
      borderUpColor: '#00c853',
      borderDownColor: '#ff5252',
      wickUpColor: '#00c85380',
      wickDownColor: '#ff525280',
    });

    const candleData: CandlestickData<Time>[] = bars.map(b => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candleSeries.setData(candleData);

    // SuperTrend line — two line series (green + red) with NaN gaps
    if (stOutput.values.length > 0) {
      const greenLine: LineData<Time>[] = [];
      const redLine: LineData<Time>[] = [];

      let prevTrend: number | null = null;
      for (const v of stOutput.values) {
        const point: LineData<Time> = { time: v.time as Time, value: v.st };
        if (v.trend === 1) {
          greenLine.push(point);
          // Connecting point at transition, NaN gap otherwise
          redLine.push(prevTrend === -1 ? point : { time: v.time as Time, value: NaN });
        } else {
          redLine.push(point);
          greenLine.push(prevTrend === 1 ? point : { time: v.time as Time, value: NaN });
        }
        prevTrend = v.trend;
      }

      const greenSeries = chart.addSeries(LineSeries, {
        color: '#00c853',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      greenSeries.setData(greenLine);

      const redSeries = chart.addSeries(LineSeries, {
        color: '#ff5252',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      redSeries.setData(redLine);
    }

    // Buy/Sell markers
    if (stOutput.signals.length > 0) {
      const markers: SeriesMarker<Time>[] = stOutput.signals.map(s => ({
        time: s.time as Time,
        position: s.direction === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
        color: s.direction === 'buy' ? '#00c853' : '#ff5252',
        shape: s.direction === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
        text: s.direction === 'buy' ? 'Buy' : 'Sell',
      }));
      createSeriesMarkers(candleSeries, markers);
    }

    // Price lines: Entry, SL, Target
    if (entryPrice) {
      candleSeries.createPriceLine({
        price: entryPrice,
        color: 'rgba(255,255,255,0.6)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Entry',
      });
    }
    if (stopLoss) {
      candleSeries.createPriceLine({
        price: stopLoss,
        color: '#ff5252',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'SL',
      });
    }
    if (target) {
      candleSeries.createPriceLine({
        price: target,
        color: '#00c853',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'T1',
      });
    }

    chart.timeScale().fitContent();

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
  }, [bars, stOutput, entryPrice, stopLoss, target]);

  if (bars.length < 20) {
    return (
      <div className="py-6 text-center text-xs text-gray-500">
        No chart data for {symbol}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <span className="text-[11px] font-black text-white">{symbol}</span>
        {currentST && (
          <>
            <span className="text-[10px] font-mono font-bold" style={{ color: trendColor }}>
              ST {currentST.st.toFixed(2)}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase"
              style={{ background: `${trendColor}15`, color: trendColor, border: `1px solid ${trendColor}30` }}
            >
              {trendLabel}
            </span>
          </>
        )}
        {stAgainstTrade && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            ST against trade
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {(['regular', 'ha'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setCandleSource(mode)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                candleSource === mode
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {mode === 'regular' ? 'Regular' : 'H-Ashi'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="rounded-lg overflow-hidden" />
    </div>
  );
};

export default MiniSuperTrendChart;
