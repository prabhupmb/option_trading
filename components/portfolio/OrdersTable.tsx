import React, { useMemo } from 'react';
import { Order } from '../../types/portfolio';
import { formatMoney, formatET, sideChipColor } from './helpers';

interface Props {
    orders: Order[];
}

const statusColor = (s: string) => {
    const u = s.toUpperCase();
    if (u === 'FILLED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (u === 'REJECTED' || u === 'CANCELED' || u === 'CANCELLED') return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (u === 'QUEUED' || u === 'WORKING' || u === 'NEW' || u === 'ACCEPTED') return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
};

const roleChip = (r: string | null) => {
    if (!r) return null;
    const cls = r === 'ENTRY' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
        : r === 'TAKE_PROFIT' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
        : 'bg-red-500/10 border-red-500/25 text-red-400';
    const label = r === 'TAKE_PROFIT' ? 'TP' : r === 'STOP_LOSS' ? 'SL' : r;
    return <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${cls}`}>{label}</span>;
};

const OrdersTable: React.FC<Props> = ({ orders }) => {
    // Group children under parents
    const { roots, children } = useMemo(() => {
        const childMap = new Map<string, Order[]>();
        const roots: Order[] = [];
        orders.forEach(o => {
            if (o.parentOrderId) {
                const list = childMap.get(o.parentOrderId) || [];
                list.push(o);
                childMap.set(o.parentOrderId, list);
            } else {
                roots.push(o);
            }
        });
        return { roots, children: childMap };
    }, [orders]);

    const renderRow = (o: Order, indent = false) => {
        const isRejected = o.status.toUpperCase() === 'REJECTED';
        return (
            <tr key={o.orderId} className={`border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30 ${indent ? 'bg-[#0a0e14]/50' : ''}`}>
                <td className={`px-2.5 py-2 font-bold text-white whitespace-nowrap ${indent ? 'pl-6' : ''}`}>
                    {indent && <span className="text-slate-700 mr-1">└</span>}
                    {o.underlying || o.symbol}
                </td>
                <td className="px-2.5 py-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${sideChipColor(o.instruction)}`}>
                        {o.instruction.replace(/_/g, ' ')}
                    </span>
                </td>
                <td className="px-2.5 py-2 text-[10px] text-slate-400 uppercase">{o.orderType}</td>
                <td className="px-2.5 py-2">{roleChip(o.legRole)}</td>
                <td className="px-2.5 py-2 font-mono text-slate-300">{o.filledQty}/{o.quantity}</td>
                <td className="px-2.5 py-2 font-mono text-slate-400">{formatMoney(o.limitPrice)}</td>
                <td className="px-2.5 py-2 font-mono text-slate-400">{formatMoney(o.stopPrice)}</td>
                <td className="px-2.5 py-2 font-mono text-slate-300">{formatMoney(o.fillPrice)}</td>
                <td className="px-2.5 py-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${statusColor(o.status)}`}
                        title={isRejected && o.statusDescription ? o.statusDescription : undefined}
                    >
                        {o.status}
                    </span>
                    {isRejected && o.statusDescription && (
                        <div className="text-[9px] text-red-400/70 mt-0.5 max-w-[200px] truncate">{o.statusDescription}</div>
                    )}
                </td>
                <td className="px-2.5 py-2 text-[10px] text-slate-500 font-mono whitespace-nowrap">{formatET(o.enteredAt)}</td>
            </tr>
        );
    };

    return (
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="border-b border-[#1e2430]">
                            {['Symbol', 'Side', 'Type', 'Role', 'Qty', 'Limit', 'Stop', 'Fill', 'Status', 'Time'].map(h => (
                                <th key={h} className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {roots.length === 0 ? (
                            <tr><td colSpan={10} className="px-4 py-8 text-center text-xs text-slate-600">No orders</td></tr>
                        ) : roots.map(o => (
                            <React.Fragment key={o.orderId}>
                                {renderRow(o)}
                                {(children.get(o.orderId) || []).map(child => renderRow(child, true))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrdersTable;
