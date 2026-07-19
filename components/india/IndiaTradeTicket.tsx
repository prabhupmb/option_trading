// ─── India / Zerodha Order Ticket ────────────────────────────
// Calls n8n webhooks for LTP and manual trade placement.
// NEVER logs or renders the secret value.
import React, { useState, useEffect } from 'react';

type Direction = 'BUY' | 'SELL';
type Product   = 'CNC' | 'MIS';
type OrderType = 'MARKET' | 'LIMIT';
type SizeMode  = 'amount' | 'shares';

export interface IndiaTicketPrefill {
  symbol?:    string;
  direction?: Direction;
  product?:   Product;
  target?:    number;
  stop?:      number;
  amount?:    number;
}

interface TradeResult {
  ok:            boolean;
  symbol?:       string;
  qty?:          number;
  order_id?:     string;
  order_status?: string;
  fill_price?:   number;
  protection?:   unknown;
  trade_id?:     string;
  mis_warning?:  string;
  error?:        string;
  login_url?:    string;
}

interface Props {
  prefill?:   IndiaTicketPrefill;
  onSuccess?: (r: TradeResult) => void;
  onClose?:   () => void;
}

// ─── Constants ───────────────────────────────────────────────
const WEBHOOK   = 'https://prabhupadala01.app.n8n.cloud/webhook';

// Access only at call-time — never bind to a variable that gets logged.
const getSecret = (): string =>
  (import.meta.env.VITE_INDIA_TRADE_SECRET as string | undefined) ?? '';

const secretPresent = (): boolean => getSecret().trim().length > 0;

// ─── Error mapper ────────────────────────────────────────────
interface MappedError { msg: string; loginUrl?: string }

const mapApiError = (raw: string | undefined, loginUrl?: string): MappedError => {
  const r = (raw ?? '').toLowerCase();
  if (r === 'unauthorized' || r.includes('unauthorized')) {
    return {
      msg: 'Trade service rejected the request — secret mismatch. Check VITE_INDIA_TRADE_SECRET matches the backend.',
    };
  }
  if (r === 'zerodha_token_stale' || r.includes('token_stale') || r.includes('stale')) {
    return { msg: 'Zerodha session expired — please log in to Kite.', loginUrl };
  }
  return { msg: raw ?? 'Unknown error from trade service.', loginUrl };
};

// ─── INR formatter ───────────────────────────────────────────
const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Test connection state ───────────────────────────────────
type ConnTest =
  | 'idle'
  | 'loading'
  | { ok: true;  price: number; sym: string }
  | { ok: false; msg: string; loginUrl?: string };

// ─── Component ───────────────────────────────────────────────
const IndiaTradeTicket: React.FC<Props> = ({ prefill, onSuccess, onClose }) => {
  const [symbol,       setSymbol]       = useState(prefill?.symbol?.toUpperCase() ?? '');
  const [ltp,          setLtp]          = useState<number | null>(null);
  const [ltpError,     setLtpError]     = useState<MappedError | null>(null);
  const [ltpLoading,   setLtpLoading]   = useState(false);
  const [direction,    setDirection]    = useState<Direction>(prefill?.direction ?? 'BUY');
  const [product,      setProduct]      = useState<Product>(prefill?.product ?? 'CNC');
  const [orderType,    setOrderType]    = useState<OrderType>('MARKET');
  const [limitPrice,   setLimitPrice]   = useState('');
  const [sizeMode,     setSizeMode]     = useState<SizeMode>('amount');
  const [amount,       setAmount]       = useState(prefill?.amount ? String(prefill.amount) : '20000');
  const [shares,       setShares]       = useState('');
  const [protectionOn, setProtectionOn] = useState(!!(prefill?.target || prefill?.stop));
  const [targetPrice,  setTargetPrice]  = useState(prefill?.target ? String(prefill.target) : '');
  const [stopPrice,    setStopPrice]    = useState(prefill?.stop   ? String(prefill.stop)   : '');
  const [stage,        setStage]        = useState<'form' | 'confirm' | 'result'>('form');
  const [submitting,   setSubmitting]   = useState(false);
  const [tradeResult,  setTradeResult]  = useState<TradeResult | null>(null);
  const [valError,     setValError]     = useState<string | null>(null);
  const [connTest,     setConnTest]     = useState<ConnTest>('idle');

  // ─── LTP fetch (declared before useEffect + early return to avoid TDZ) ──
  const fetchLtp = async (sym?: string) => {
    const s = (sym ?? symbol).trim().toUpperCase();
    if (!s) return;
    setLtpLoading(true);
    setLtpError(null);
    try {
      const res  = await fetch(`${WEBHOOK}/india-ltp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret: getSecret(), symbol: s }),
      });
      const data = await res.json();
      if (data.ok) {
        setLtp(data.ltp);
        setSymbol(s);
      } else {
        setLtpError(mapApiError(data.error, data.login_url));
      }
    } catch {
      setLtpError({ msg: "Can't reach the trade service." });
    } finally {
      setLtpLoading(false);
    }
  };

  // Auto-fetch LTP when opened with a prefilled symbol
  useEffect(() => {
    if (prefill?.symbol) fetchLtp(prefill.symbol.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Secret missing guard — shown before any API interaction ─
  if (!secretPresent()) {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 space-y-3">
        <p className="text-amber-300 font-bold text-sm">Trade service secret not configured</p>
        <p className="text-amber-400/80 text-xs leading-relaxed">
          Set <code className="bg-slate-800 px-1 rounded font-mono">VITE_INDIA_TRADE_SECRET</code> in
          your <code className="bg-slate-800 px-1 rounded font-mono">.env</code> file and restart
          the dev server (or redeploy on the host).
        </p>
        <p className="text-slate-500 text-[10px]">
          On Cloud Run, also set it as a build-time env var — Vite bakes env vars at build time,
          not runtime.
        </p>
      </div>
    );
  }

  // ─── Test connection ─────────────────────────────────────────
  const testConnection = async () => {
    setConnTest('loading');
    try {
      const res  = await fetch(`${WEBHOOK}/india-ltp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret: getSecret(), symbol: 'RELIANCE' }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnTest({ ok: true, price: data.ltp, sym: data.symbol ?? 'RELIANCE' });
      } else {
        const mapped = mapApiError(data.error, data.login_url);
        setConnTest({ ok: false, msg: mapped.msg, loginUrl: mapped.loginUrl });
      }
    } catch {
      setConnTest({ ok: false, msg: "Can't reach the trade service." });
    }
  };

  // ─── Derived values ──────────────────────────────────────────
  const price     = orderType === 'LIMIT' ? (parseFloat(limitPrice) || 0) : (ltp ?? 0);
  const qty       = sizeMode === 'amount'
    ? (ltp && ltp > 0 ? Math.floor(parseFloat(amount) / ltp) : 0)
    : (parseInt(shares) || 0);
  const estCost   = qty * price;
  const isSellCNC = direction === 'SELL' && product === 'CNC';

  const tgt    = parseFloat(targetPrice) || 0;
  const stp    = parseFloat(stopPrice)   || 0;
  const reward = direction === 'BUY' ? tgt - price : price - tgt;
  const risk   = direction === 'BUY' ? price - stp : stp - price;
  const rrNum  = protectionOn && !isSellCNC && risk > 0 && !isNaN(reward / risk)
    ? reward / risk : null;
  const rrStr  = rrNum !== null ? `1:${rrNum.toFixed(2)}` : '—';
  const rrGood = rrNum !== null && rrNum >= 1.5;

  // ─── Validation ──────────────────────────────────────────────
  const validate = (): string | null => {
    if (!symbol.trim())                                          return 'Symbol is required';
    if (ltp === null)                                            return 'Fetch price first (click Get Price or press Tab)';
    if (qty < 1)                                                 return sizeMode === 'amount'
      ? `Amount too small — need at least ${inr(ltp)} for 1 share`
      : 'Quantity must be at least 1';
    if (orderType === 'LIMIT' && !(parseFloat(limitPrice) > 0)) return 'Limit price is required';
    if (protectionOn && !isSellCNC) {
      if (!(tgt > 0)) return 'Target price is required';
      if (!(stp > 0)) return 'Stop price is required';
      if (direction === 'BUY') {
        if (stp >= price) return 'Stop must be below entry price';
        if (tgt <= price) return 'Target must be above entry price';
      } else {
        if (tgt >= price) return 'Target must be below entry price for a short';
        if (stp <= price) return 'Stop must be above entry price for a short';
      }
    }
    return null;
  };

  const handleReview = () => {
    const err = validate();
    if (err) { setValError(err); return; }
    setValError(null);
    setStage('confirm');
  };

  // ─── Place order ─────────────────────────────────────────────
  const handlePlace = async () => {
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      secret:     getSecret(),
      symbol:     symbol.trim().toUpperCase(),
      direction,
      product,
      order_type: orderType,
    };
    if (orderType === 'LIMIT')       body.limit_price = parseFloat(limitPrice);
    if (sizeMode === 'amount')       body.amount      = parseFloat(amount);
    else                             body.qty         = qty;
    if (protectionOn && !isSellCNC) { body.target = tgt; body.stop = stp; }

    try {
      const res  = await fetch(`${WEBHOOK}/india-manual-trade`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data: TradeResult = await res.json();
      if (!data.ok) {
        const mapped = mapApiError(data.error, data.login_url);
        setTradeResult({ ...data, error: mapped.msg, login_url: mapped.loginUrl });
      } else {
        setTradeResult(data);
      }
      setStage('result');
      if (data.ok) onSuccess?.(data);
    } catch {
      setTradeResult({ ok: false, error: "Can't reach the trade service." });
      setStage('result');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Confirm card ────────────────────────────────────────────
  if (stage === 'confirm') {
    const dirLabel = direction === 'BUY' ? 'Buy' : 'Sell';
    const btnCls   = direction === 'BUY'
      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Confirm order</p>
          <p className="text-white font-black text-base font-mono">
            {dirLabel} {qty} × {symbol} ({product}, {orderType.toLowerCase()})
            {estCost > 0 && <span className="text-amber-400"> ≈ {inr(estCost)}</span>}
          </p>
          {protectionOn && !isSellCNC && (
            <div className="text-xs font-mono space-y-1 pt-1 border-t border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Target</span>
                <span className="text-emerald-400">{inr(tgt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stop</span>
                <span className="text-rose-400">{inr(stp)}</span>
              </div>
              <p className="text-[10px] text-slate-600 pt-1">
                {product === 'CNC' ? 'Protection placed as GTT OCO' : 'Stop placed as SL-M; target exit is manual'}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStage('form')}
            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wide hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePlace}
            disabled={submitting}
            className={`flex-1 py-3 rounded-xl text-white text-xs font-black uppercase tracking-wide shadow-lg transition-colors disabled:opacity-40 ${btnCls}`}
          >
            {submitting ? 'Placing…' : `Place ${dirLabel} order`}
          </button>
        </div>
      </div>
    );
  }

  // ─── Result card ─────────────────────────────────────────────
  if (stage === 'result' && tradeResult) {
    const ok = tradeResult.ok;
    return (
      <div className={`rounded-xl border p-4 space-y-3 ${ok ? 'bg-emerald-950/30 border-emerald-700/40' : 'bg-rose-950/30 border-rose-700/40'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-lg ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>{ok ? '✓' : '✕'}</span>
          <span className={`font-black uppercase tracking-wide text-sm ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>
            {ok ? 'Order placed' : 'Order failed'}
          </span>
        </div>
        {ok ? (
          <div className="space-y-1.5 text-xs font-mono">
            {tradeResult.fill_price   && <div className="flex justify-between"><span className="text-slate-500">Fill price</span><span className="text-amber-300 font-bold">{inr(tradeResult.fill_price)}</span></div>}
            {tradeResult.qty          && <div className="flex justify-between"><span className="text-slate-500">Quantity</span><span className="text-white">{tradeResult.qty}</span></div>}
            {tradeResult.order_id     && <div className="flex justify-between"><span className="text-slate-500">Order ID</span><span className="text-white">{tradeResult.order_id}</span></div>}
            {tradeResult.order_status && <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-emerald-400">{tradeResult.order_status}</span></div>}
            {tradeResult.protection   && <div className="flex justify-between"><span className="text-slate-500">Protection</span><span className="text-slate-300">Placed ✓</span></div>}
            {tradeResult.mis_warning  && <p className="text-[10px] text-amber-400 pt-1 border-t border-slate-700">{tradeResult.mis_warning}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-rose-300 text-sm leading-relaxed">{tradeResult.error}</p>
            {tradeResult.login_url && (
              <a href={tradeResult.login_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wide transition-colors">
                Log in to Kite →
              </a>
            )}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  // ─── Main form ───────────────────────────────────────────────
  const isBuy      = direction === 'BUY';
  const reviewCls  = isBuy
    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20';

  return (
    <div className="space-y-4">

      {/* Symbol + LTP */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Symbol</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={e => { setSymbol(e.target.value.toUpperCase()); setLtp(null); }}
            onBlur={() => symbol && fetchLtp()}
            placeholder="DIXON"
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-slate-500 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm uppercase outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          />
          <button
            onClick={() => fetchLtp()}
            disabled={!symbol || ltpLoading}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            {ltpLoading ? '…' : 'Get price'}
          </button>
        </div>
        {ltp !== null && (
          <p className="text-amber-300 font-mono font-black text-2xl mt-2">{inr(ltp)}</p>
        )}
        {ltpError && (
          <div className="mt-1.5 space-y-1">
            <p className="text-rose-400 text-xs leading-relaxed">{ltpError.msg}</p>
            {ltpError.loginUrl && (
              <a href={ltpError.loginUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs underline font-bold text-rose-300 hover:text-rose-200">
                Log in to Kite →
              </a>
            )}
          </div>
        )}
      </div>

      {/* BUY / SELL */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Direction</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDirection('BUY')}
            className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 ${direction === 'BUY'
              ? 'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-900/30'
              : 'bg-slate-900 text-slate-500 border border-slate-700 hover:border-emerald-700 hover:text-emerald-400'}`}
          >
            ▲ BUY
          </button>
          <button
            onClick={() => setDirection('SELL')}
            className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500 ${direction === 'SELL'
              ? 'bg-rose-600 text-white border border-rose-500 shadow-lg shadow-rose-900/30'
              : 'bg-slate-900 text-slate-500 border border-slate-700 hover:border-rose-700 hover:text-rose-400'}`}
          >
            ▼ SELL
          </button>
        </div>
      </div>

      {/* Product */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Product</label>
        <div className="grid grid-cols-2 gap-2">
          {(['CNC', 'MIS'] as Product[]).map(p => (
            <button key={p} onClick={() => setProduct(p)}
              className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 ${product === p
                ? 'bg-slate-700 text-white border border-slate-500'
                : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-600 hover:text-slate-300'}`}
            >
              {p === 'CNC' ? 'CNC · Delivery' : 'MIS · Intraday'}
            </button>
          ))}
        </div>
      </div>

      {/* Contextual banners */}
      {isSellCNC && (
        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-300 space-y-1">
          <p>Sell + CNC exits shares you already hold. No target/stop applies.</p>
          <p className="text-slate-500">Shorting instead? Switch product to MIS.</p>
        </div>
      )}
      {product === 'MIS' && (
        <div className="rounded-lg bg-amber-950/40 border border-amber-700/40 p-3 text-xs text-amber-300">
          Intraday — Zerodha squares off open MIS positions around 3:20 PM IST.
        </div>
      )}

      {/* Order type */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Order type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['MARKET', 'LIMIT'] as OrderType[]).map(t => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 ${orderType === t
                ? 'bg-slate-700 text-white border border-slate-500'
                : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-600 hover:text-slate-300'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {orderType === 'LIMIT' && (
          <div className="mt-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Limit price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">₹</span>
              <input
                type="text" inputMode="decimal" value={limitPrice}
                onChange={e => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg pl-7 pr-3 py-2 text-amber-300 font-mono font-bold text-sm outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>
        )}
      </div>

      {/* Size */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Size</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {([['amount', '₹ Amount'], ['shares', 'Shares']] as [SizeMode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setSizeMode(m)}
              className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 ${sizeMode === m
                ? 'bg-slate-700 text-white border border-slate-500'
                : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-600 hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {sizeMode === 'amount' ? (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">₹</span>
            <input
              type="text" inputMode="decimal" value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full bg-slate-900 border border-slate-700 focus:border-slate-500 rounded-lg pl-7 pr-3 py-2 text-white font-mono font-bold text-sm outline-none transition-colors"
            />
          </div>
        ) : (
          <input
            type="text" inputMode="numeric" value={shares} placeholder="Shares"
            onChange={e => setShares(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-slate-500 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm outline-none transition-colors"
          />
        )}
        {sizeMode === 'amount' && ltp && ltp > 0 && (
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            ≈ {Math.floor(parseFloat(amount) / ltp)} shares at {inr(ltp)}
          </p>
        )}
      </div>

      {/* Protection */}
      {!isSellCNC && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox" checked={protectionOn}
              onChange={e => setProtectionOn(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600 accent-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Attach target &amp; stop</span>
          </label>
          {protectionOn && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Target</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">₹</span>
                  <input type="text" inputMode="decimal" value={targetPrice}
                    onChange={e => setTargetPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full bg-emerald-950/30 border border-emerald-700/40 focus:border-emerald-500 rounded-lg pl-5 pr-2 py-2 text-emerald-300 font-mono font-bold text-xs outline-none transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1">Stop</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">₹</span>
                  <input type="text" inputMode="decimal" value={stopPrice}
                    onChange={e => setStopPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full bg-rose-950/30 border border-rose-700/40 focus:border-rose-500 rounded-lg pl-5 pr-2 py-2 text-rose-300 font-mono font-bold text-xs outline-none transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <p className="col-span-2 text-[10px] text-slate-600">
                {product === 'CNC' ? 'Placed as GTT OCO' : 'Stop placed as SL-M; target exit is manual'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">Order summary</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-0.5">Quantity</p>
            <p className="font-mono font-black text-white text-sm">{qty > 0 ? qty : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-0.5">Est. cost</p>
            <p className="font-mono font-black text-amber-400 text-sm">{estCost > 0 ? inr(estCost) : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-0.5">R:R</p>
            <p className={`font-mono font-black text-sm ${rrNum === null ? 'text-slate-500' : rrGood ? 'text-emerald-400' : 'text-amber-400'}`}>
              {rrStr}
            </p>
          </div>
        </div>
      </div>

      {/* Validation error */}
      {valError && <p className="text-amber-400 text-xs font-bold">{valError}</p>}

      {/* Review button */}
      <button
        onClick={handleReview}
        disabled={!symbol || ltp === null || qty < 1}
        className={`w-full py-3.5 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/30 ${reviewCls}`}
      >
        Review {isBuy ? 'buy' : 'sell'} order
      </button>

      {/* ── Footer: Test connection ── */}
      <div className="pt-1 border-t border-slate-800/60 flex items-center gap-3">
        <button
          onClick={testConnection}
          disabled={connTest === 'loading'}
          className="text-[10px] text-slate-500 hover:text-slate-300 font-bold underline underline-offset-2 transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 rounded"
        >
          {connTest === 'loading' ? 'Testing…' : 'Test connection'}
        </button>

        {connTest !== 'idle' && connTest !== 'loading' && (
          connTest.ok ? (
            <span className="text-[10px] font-mono text-emerald-400">
              ✓ Connected · {connTest.sym} {inr(connTest.price)}
            </span>
          ) : (
            <span className="text-[10px] text-rose-400 leading-snug">
              {connTest.msg}
              {connTest.loginUrl && (
                <> · <a href={connTest.loginUrl} target="_blank" rel="noopener noreferrer"
                  className="underline font-bold hover:text-rose-300">Log in to Kite</a></>
              )}
            </span>
          )
        )}
      </div>

    </div>
  );
};

export default IndiaTradeTicket;
