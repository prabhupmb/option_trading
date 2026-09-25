/**
 * TradePlanPlugin — lightweight-charts v5 series primitive
 * Draws reward zone (entry→T1) and risk zone (entry→SL) as filled rectangles.
 */
import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
  SeriesType,
  IChartApiBase,
  ISeriesApi,
  Coordinate,
} from 'lightweight-charts';

interface ZoneConfig {
  entry: number;
  target: number;
  stopLoss: number;
}

class TradePlanRenderer implements IPrimitivePaneRenderer {
  private _zones: { y1: number; y2: number; color: string }[];

  constructor(zones: { y1: number; y2: number; color: string }[]) {
    this._zones = zones;
  }

  draw(target: any): void {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const w = scope.bitmapSize.width;
      const hRatio = scope.horizontalPixelRatio;
      const vRatio = scope.verticalPixelRatio;

      for (const z of this._zones) {
        const y1 = Math.round(z.y1 * vRatio);
        const y2 = Math.round(z.y2 * vRatio);
        const top = Math.min(y1, y2);
        const height = Math.abs(y2 - y1);
        if (height < 1) continue;

        ctx.fillStyle = z.color;
        ctx.fillRect(0, top, w, height);
      }
    });
  }
}

class TradePlanPaneView implements IPrimitivePaneView {
  private _zones: { y1: number; y2: number; color: string }[] = [];

  update(zones: { y1: number; y2: number; color: string }[]) {
    this._zones = zones;
  }

  zOrder(): 'bottom' {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (this._zones.length === 0) return null;
    return new TradePlanRenderer(this._zones);
  }
}

export class TradePlanPlugin implements ISeriesPrimitive<Time> {
  private _config: ZoneConfig;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _paneView = new TradePlanPaneView();

  constructor(config: ZoneConfig) {
    this._config = config;
  }

  updateConfig(config: ZoneConfig) {
    this._config = config;
  }

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._series = param.series;
  }

  detached(): void {
    this._series = null;
  }

  updateAllViews(): void {
    if (!this._series) return;

    const zones: { y1: number; y2: number; color: string }[] = [];

    const entryY = this._series.priceToCoordinate(this._config.entry);
    const targetY = this._series.priceToCoordinate(this._config.target);
    const slY = this._series.priceToCoordinate(this._config.stopLoss);

    if (entryY !== null && targetY !== null) {
      zones.push({
        y1: entryY as number,
        y2: targetY as number,
        color: 'rgba(34, 197, 94, 0.08)',  // green reward zone
      });
    }

    if (entryY !== null && slY !== null) {
      zones.push({
        y1: entryY as number,
        y2: slY as number,
        color: 'rgba(239, 68, 68, 0.08)',  // red risk zone
      });
    }

    this._paneView.update(zones);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
