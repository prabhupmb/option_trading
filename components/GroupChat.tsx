import React, { useState, useRef, useEffect, useMemo } from 'react';

// ─── TYPES ─────────────────────────────────────────────
interface Member {
    id: string;
    name: string;
    initials: string;
    winRate: number;
    online: boolean;
    color: string;
}

interface Reaction {
    emoji: string;
    count: number;
    reacted: boolean;
}

interface SignalData {
    symbol: string;
    action: 'BUY' | 'SELL';
    strikePrice: number;
    expiry: string;
    stopLoss: number;
    target: number;
    riskReward: string;
    currentPrice: number;
    responses: { in: number; skip: number; watching: number };
    myResponse?: 'in' | 'skip' | 'watching' | null;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderInitials: string;
    senderColor: string;
    text: string;
    timestamp: string;
    reactions: Reaction[];
    signal?: SignalData;
}

interface TodaySignal {
    symbol: string;
    action: 'BUY' | 'SELL';
    pnl: string;
    status: 'pending' | 'win' | 'loss';
    time: string;
    sender: string;
}

// ─── MOCK DATA ─────────────────────────────────────────
const MEMBERS: Member[] = [
    { id: '1', name: 'Prabhu Padala', initials: 'PP', winRate: 85, online: true, color: '#00C853' },
    { id: '2', name: 'Ravi Sharma', initials: 'RS', winRate: 72, online: true, color: '#2196F3' },
    { id: '3', name: 'Priya Gupta', initials: 'PG', winRate: 68, online: true, color: '#E040FB' },
    { id: '4', name: 'Anil Kumar', initials: 'AK', winRate: 76, online: false, color: '#FF9800' },
    { id: '5', name: 'Deepak Verma', initials: 'DV', winRate: 61, online: true, color: '#00BCD4' },
    { id: '6', name: 'Sneha Reddy', initials: 'SR', winRate: 79, online: false, color: '#FF5252' },
    { id: '7', name: 'Vikram Singh', initials: 'VS', winRate: 83, online: true, color: '#FFD740' },
    { id: '8', name: 'Meena Patel', initials: 'MP', winRate: 70, online: false, color: '#69F0AE' },
    { id: '9', name: 'Karthik Rao', initials: 'KR', winRate: 65, online: true, color: '#448AFF' },
    { id: '10', name: 'Anjali Das', initials: 'AD', winRate: 74, online: false, color: '#FF80AB' },
];

const MOCK_MESSAGES: ChatMessage[] = [
    {
        id: 'm1', senderId: '2', senderName: 'Ravi Sharma', senderInitials: 'RS', senderColor: '#2196F3',
        text: 'Good morning team! Markets looking bullish today 🚀', timestamp: '09:15 AM',
        reactions: [{ emoji: '🔥', count: 4, reacted: false }, { emoji: '👍', count: 3, reacted: true }],
    },
    {
        id: 'm2', senderId: '1', senderName: 'Prabhu Padala', senderInitials: 'PP', senderColor: '#00C853',
        text: 'Agreed! NIFTY broke through resistance. @Ravi Sharma did you see the volume surge on SPY?', timestamp: '09:18 AM',
        reactions: [{ emoji: '✅', count: 2, reacted: false }],
    },
    {
        id: 'm3', senderId: '3', senderName: 'Priya Gupta', senderInitials: 'PG', senderColor: '#E040FB',
        text: '', timestamp: '09:22 AM',
        reactions: [{ emoji: '🔥', count: 6, reacted: true }, { emoji: '✅', count: 3, reacted: false }],
        signal: {
            symbol: 'AAPL', action: 'BUY', strikePrice: 195, expiry: 'Mar 28, 2025',
            stopLoss: 188, target: 210, riskReward: '1:2.1', currentPrice: 193.42,
            responses: { in: 4, skip: 2, watching: 1 }, myResponse: null,
        },
    },
    {
        id: 'm4', senderId: '5', senderName: 'Deepak Verma', senderInitials: 'DV', senderColor: '#00BCD4',
        text: 'That AAPL setup looks solid @Priya Gupta. I\'m watching for confirmation on the 15m chart.', timestamp: '09:25 AM',
        reactions: [{ emoji: '👍', count: 2, reacted: false }],
    },
    {
        id: 'm5', senderId: '7', senderName: 'Vikram Singh', senderInitials: 'VS', senderColor: '#FFD740',
        text: '', timestamp: '09:30 AM',
        reactions: [{ emoji: '🔥', count: 3, reacted: false }, { emoji: '✅', count: 5, reacted: true }],
        signal: {
            symbol: 'TSLA', action: 'SELL', strikePrice: 245, expiry: 'Mar 21, 2025',
            stopLoss: 260, target: 220, riskReward: '1:1.7', currentPrice: 251.30,
            responses: { in: 3, skip: 1, watching: 2 }, myResponse: 'in',
        },
    },
    {
        id: 'm6', senderId: '9', senderName: 'Karthik Rao', senderInitials: 'KR', senderColor: '#448AFF',
        text: 'TSLA puts are printing already 💰. @Vikram Singh great call! Entry at $248 was perfect.', timestamp: '09:45 AM',
        reactions: [{ emoji: '🔥', count: 5, reacted: true }, { emoji: '👍', count: 3, reacted: false }],
    },
    {
        id: 'm7', senderId: '2', senderName: 'Ravi Sharma', senderInitials: 'RS', senderColor: '#2196F3',
        text: '@Prabhu Padala yes! SPY volume was 2x average on that 5m candle. Very bullish signal.', timestamp: '09:48 AM',
        reactions: [{ emoji: '✅', count: 2, reacted: false }],
    },
    {
        id: 'm8', senderId: '1', senderName: 'Prabhu Padala', senderInitials: 'PP', senderColor: '#00C853',
        text: '', timestamp: '10:05 AM',
        reactions: [{ emoji: '🔥', count: 7, reacted: false }, { emoji: '✅', count: 4, reacted: true }, { emoji: '👍', count: 2, reacted: false }],
        signal: {
            symbol: 'NVDA', action: 'BUY', strikePrice: 880, expiry: 'Apr 04, 2025',
            stopLoss: 845, target: 950, riskReward: '1:2.0', currentPrice: 872.50,
            responses: { in: 6, skip: 0, watching: 2 }, myResponse: 'in',
        },
    },
    {
        id: 'm9', senderId: '3', senderName: 'Priya Gupta', senderInitials: 'PG', senderColor: '#E040FB',
        text: 'NVDA is a monster setup. All gates passed on the daily chart. Let\'s ride this wave 🌊', timestamp: '10:08 AM',
        reactions: [{ emoji: '🔥', count: 3, reacted: false }],
    },
    {
        id: 'm10', senderId: '5', senderName: 'Deepak Verma', senderInitials: 'DV', senderColor: '#00BCD4',
        text: '', timestamp: '10:30 AM',
        reactions: [{ emoji: '👍', count: 2, reacted: false }],
        signal: {
            symbol: 'META', action: 'BUY', strikePrice: 520, expiry: 'Mar 28, 2025',
            stopLoss: 505, target: 555, riskReward: '1:2.3', currentPrice: 515.80,
            responses: { in: 2, skip: 1, watching: 3 }, myResponse: null,
        },
    },
];

const TODAY_SIGNALS: TodaySignal[] = [
    { symbol: 'AAPL', action: 'BUY', pnl: '+38%', status: 'win', time: '09:22 AM', sender: 'Priya G.' },
    { symbol: 'TSLA', action: 'SELL', pnl: '+22%', status: 'win', time: '09:30 AM', sender: 'Vikram S.' },
    { symbol: 'NVDA', action: 'BUY', pnl: 'Pending', status: 'pending', time: '10:05 AM', sender: 'Prabhu P.' },
    { symbol: 'META', action: 'BUY', pnl: '-5%', status: 'loss', time: '10:30 AM', sender: 'Deepak V.' },
];

// ─── HELPER: Render text with @mentions highlighted ────
const renderMessageText = (text: string) => {
    const parts = text.split(/(@\w[\w\s]*?\b(?=\s|$|[.!?,]))/g);
    return parts.map((part, i) =>
        part.startsWith('@') ? (
            <span key={i} className="text-[#00BCD4] font-semibold bg-[#00BCD4]/10 px-1 rounded">{part}</span>
        ) : (
            <span key={i}>{part}</span>
        )
    );
};

// ─── COMPONENT ─────────────────────────────────────────
const GroupChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [showSignalModal, setShowSignalModal] = useState(false);
    const [showMobileMembers, setShowMobileMembers] = useState(false);
    const [showMobileSignals, setShowMobileSignals] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Signal composer state
    const [signalForm, setSignalForm] = useState({
        symbol: '', action: 'BUY' as 'BUY' | 'SELL',
        strikePrice: '', expiry: '', stopLoss: '', target: '',
    });

    const riskReward = useMemo(() => {
        const entry = parseFloat(signalForm.strikePrice);
        const sl = parseFloat(signalForm.stopLoss);
        const tgt = parseFloat(signalForm.target);
        if (!entry || !sl || !tgt || entry === sl) return '-';
        const risk = Math.abs(entry - sl);
        const reward = Math.abs(tgt - entry);
        return `1:${(reward / risk).toFixed(1)}`;
    }, [signalForm.strikePrice, signalForm.stopLoss, signalForm.target]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Handlers ──────────────────────
    const handleSendMessage = () => {
        const text = inputText.trim();
        if (!text) return;
        const newMsg: ChatMessage = {
            id: `m${Date.now()}`, senderId: '1', senderName: 'Prabhu Padala', senderInitials: 'PP', senderColor: '#00C853',
            text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reactions: [],
        };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setShowMentions(false);
    };

    const handleReaction = (msgId: string, emoji: string) => {
        setMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m;
            const existing = m.reactions.find(r => r.emoji === emoji);
            if (existing) {
                return {
                    ...m, reactions: m.reactions.map(r =>
                        r.emoji === emoji ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted } : r
                    ).filter(r => r.count > 0),
                };
            }
            return { ...m, reactions: [...m.reactions, { emoji, count: 1, reacted: true }] };
        }));
    };

    const handleSignalResponse = (msgId: string, response: 'in' | 'skip' | 'watching') => {
        setMessages(prev => prev.map(m => {
            if (m.id !== msgId || !m.signal) return m;
            const prev_ = m.signal.myResponse;
            const newResponses = { ...m.signal.responses };
            if (prev_) {
                const key = prev_ === 'in' ? 'in' : prev_ === 'skip' ? 'skip' : 'watching';
                newResponses[key] = Math.max(0, newResponses[key] - 1);
            }
            if (prev_ === response) {
                return { ...m, signal: { ...m.signal, responses: newResponses, myResponse: null } };
            }
            const addKey = response === 'in' ? 'in' : response === 'skip' ? 'skip' : 'watching';
            newResponses[addKey]++;
            return { ...m, signal: { ...m.signal, responses: newResponses, myResponse: response } };
        }));
    };

    const handleShareSignal = () => {
        if (!signalForm.symbol || !signalForm.strikePrice) return;
        const newMsg: ChatMessage = {
            id: `m${Date.now()}`, senderId: '1', senderName: 'Prabhu Padala', senderInitials: 'PP', senderColor: '#00C853',
            text: '', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reactions: [],
            signal: {
                symbol: signalForm.symbol.toUpperCase(), action: signalForm.action,
                strikePrice: parseFloat(signalForm.strikePrice) || 0, expiry: signalForm.expiry || 'TBD',
                stopLoss: parseFloat(signalForm.stopLoss) || 0, target: parseFloat(signalForm.target) || 0,
                riskReward, currentPrice: parseFloat(signalForm.strikePrice) || 0,
                responses: { in: 0, skip: 0, watching: 0 }, myResponse: null,
            },
        };
        setMessages(prev => [...prev, newMsg]);
        setShowSignalModal(false);
        setSignalForm({ symbol: '', action: 'BUY', strikePrice: '', expiry: '', stopLoss: '', target: '' });
    };

    const handleInputChange = (val: string) => {
        setInputText(val);
        const lastAt = val.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === val.length - 1 - (val.length - 1 - lastAt)) {
            const afterAt = val.slice(lastAt + 1);
            if (!afterAt.includes(' ') || afterAt.length < 15) {
                setShowMentions(true);
                setMentionFilter(afterAt.toLowerCase());
                return;
            }
        }
        if (!val.includes('@')) setShowMentions(false);
    };

    const insertMention = (name: string) => {
        const lastAt = inputText.lastIndexOf('@');
        const before = inputText.slice(0, lastAt);
        setInputText(`${before}@${name} `);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    const filteredMembers = MEMBERS.filter(m =>
        m.name.toLowerCase().includes(mentionFilter)
    );

    const onlineMembersCount = MEMBERS.filter(m => m.online).length;
    const signalWins = TODAY_SIGNALS.filter(s => s.status === 'win').length;
    const signalLosses = TODAY_SIGNALS.filter(s => s.status === 'loss').length;

    // ─── RENDER ────────────────────────
    return (
        <div className="flex h-full bg-[#0D1117] text-white overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ─── LEFT SIDEBAR: Members ─── */}
            <div className={`${showMobileMembers ? 'fixed inset-0 z-50 bg-[#0D1117]' : 'hidden'} lg:block lg:relative lg:w-[200px] flex-shrink-0 border-r border-[#30363D] flex flex-col`}>
                {/* Mobile close */}
                <div className="flex items-center justify-between p-4 border-b border-[#30363D] lg:hidden">
                    <span className="text-sm font-bold">Members</span>
                    <button onClick={() => setShowMobileMembers(false)} className="text-gray-400 hover:text-white">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                <div className="p-4 border-b border-[#30363D]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Group Members</span>
                        <span className="bg-[#00BCD4]/15 text-[#00BCD4] px-1.5 py-0.5 rounded text-[10px] font-bold">{MEMBERS.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00C853]"></span>
                        <span className="text-[10px] text-gray-500">{onlineMembersCount} online</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {MEMBERS.map(m => (
                        <div key={m.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#161B22] transition-colors cursor-pointer group">
                            <div className="relative flex-shrink-0">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: m.color + '20', color: m.color }}>
                                    {m.initials}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0D1117] ${m.online ? 'bg-[#00C853]' : 'bg-gray-600'}`}></span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-white transition-colors">{m.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{m.winRate}% win rate</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── CENTER: Chat Window ─── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#30363D] bg-[#0D1117]/80 backdrop-blur-sm flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile toggles */}
                        <button onClick={() => setShowMobileMembers(true)} className="lg:hidden text-gray-400 hover:text-white">
                            <span className="material-symbols-outlined text-xl">group</span>
                        </button>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C853] to-[#00BCD4] flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-white text-lg">forum</span>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">TradingKarna Team</h2>
                            <span className="text-[10px] text-gray-500">{onlineMembersCount} members online • {TODAY_SIGNALS.length} signals today</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowMobileSignals(true)} className="lg:hidden w-8 h-8 rounded-lg hover:bg-[#161B22] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">signal_cellular_alt</span>
                        </button>
                        <button className="w-8 h-8 rounded-lg hover:bg-[#161B22] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">settings</span>
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className="group/msg animate-in fade-in duration-200">
                            {msg.signal ? (
                                /* ─── Signal Card Message ─── */
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1" style={{ backgroundColor: msg.senderColor + '20', color: msg.senderColor }}>
                                        {msg.senderInitials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-sm font-bold" style={{ color: msg.senderColor }}>{msg.senderName}</span>
                                            <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                                        </div>
                                        <div className={`rounded-xl border-2 overflow-hidden ${msg.signal.action === 'BUY' ? 'border-[#00C853]/40 bg-[#00C853]/5' : 'border-[#FF1744]/40 bg-[#FF1744]/5'}`}>
                                            {/* Signal Header */}
                                            <div className={`px-4 py-2 flex items-center gap-2 ${msg.signal.action === 'BUY' ? 'bg-[#00C853]/10' : 'bg-[#FF1744]/10'}`}>
                                                <span className="text-base">🚨</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${msg.signal.action === 'BUY' ? 'bg-[#00C853]/20 text-[#00C853]' : 'bg-[#FF1744]/20 text-[#FF1744]'}`}>SIGNAL</span>
                                                <span className="text-xs text-gray-400">from {msg.senderName}</span>
                                            </div>
                                            {/* Signal Body */}
                                            <div className="px-4 py-3 space-y-2.5">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl font-black text-white tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{msg.signal.symbol}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${msg.signal.action === 'BUY' ? 'bg-[#00C853] text-black' : 'bg-[#FF1744] text-white'}`}>{msg.signal.action}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Strike</span>
                                                        <span className="text-white font-mono font-semibold">${msg.signal.strikePrice.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Expiry</span>
                                                        <span className="text-white font-semibold">{msg.signal.expiry}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Stop Loss</span>
                                                        <span className="text-[#FF1744] font-mono font-semibold">${msg.signal.stopLoss.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Target</span>
                                                        <span className="text-[#00C853] font-mono font-semibold">${msg.signal.target.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">R/R Ratio</span>
                                                        <span className="text-[#00BCD4] font-mono font-bold">{msg.signal.riskReward}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Current</span>
                                                        <span className="text-white font-mono font-semibold">${msg.signal.currentPrice.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                {/* Action Buttons */}
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => handleSignalResponse(msg.id, 'in')}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1 ${msg.signal.myResponse === 'in' ? 'bg-[#00C853] text-black' : 'bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/30 hover:bg-[#00C853]/20'}`}
                                                    >
                                                        ✅ I'm In
                                                    </button>
                                                    <button
                                                        onClick={() => handleSignalResponse(msg.id, 'skip')}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1 ${msg.signal.myResponse === 'skip' ? 'bg-[#FF1744] text-white' : 'bg-[#FF1744]/10 text-[#FF1744] border border-[#FF1744]/30 hover:bg-[#FF1744]/20'}`}
                                                    >
                                                        ❌ Skip
                                                    </button>
                                                    <button
                                                        onClick={() => handleSignalResponse(msg.id, 'watching')}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1 ${msg.signal.myResponse === 'watching' ? 'bg-[#FFD740] text-black' : 'bg-[#FFD740]/10 text-[#FFD740] border border-[#FFD740]/30 hover:bg-[#FFD740]/20'}`}
                                                    >
                                                        👀 Watching
                                                    </button>
                                                </div>
                                                {/* Response Counter */}
                                                <div className="text-[10px] text-gray-500 flex gap-3 pt-0.5">
                                                    <span>✅ {msg.signal.responses.in} In</span>
                                                    <span>❌ {msg.signal.responses.skip} Skip</span>
                                                    <span>👀 {msg.signal.responses.watching} Watching</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Reactions */}
                                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                            {msg.reactions.map((r, ri) => (
                                                <button key={ri} onClick={() => handleReaction(msg.id, r.emoji)}
                                                    className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all hover:scale-105 ${r.reacted ? 'bg-[#00BCD4]/15 border border-[#00BCD4]/40 text-[#00BCD4]' : 'bg-[#161B22] border border-[#30363D] text-gray-400 hover:border-gray-500'}`}
                                                >
                                                    <span>{r.emoji}</span>
                                                    <span className="font-mono text-[10px]">{r.count}</span>
                                                </button>
                                            ))}
                                            {/* Add reaction button */}
                                            <span className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                                {['👍', '✅', '🔥'].filter(e => !msg.reactions.find(r => r.emoji === e)).map(e => (
                                                    <button key={e} onClick={() => handleReaction(msg.id, e)}
                                                        className="px-1.5 py-0.5 rounded-full text-xs bg-[#161B22] border border-[#30363D] text-gray-500 hover:border-gray-400 hover:text-gray-300 transition-all mr-1"
                                                    >
                                                        {e}
                                                    </button>
                                                ))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ─── Regular Text Message ─── */
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ backgroundColor: msg.senderColor + '20', color: msg.senderColor }}>
                                        {msg.senderInitials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold" style={{ color: msg.senderColor }}>{msg.senderName}</span>
                                            <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                                        </div>
                                        <p className="text-[13px] text-gray-300 leading-relaxed">{renderMessageText(msg.text)}</p>
                                        {/* Reactions */}
                                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                            {msg.reactions.map((r, ri) => (
                                                <button key={ri} onClick={() => handleReaction(msg.id, r.emoji)}
                                                    className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all hover:scale-105 ${r.reacted ? 'bg-[#00BCD4]/15 border border-[#00BCD4]/40 text-[#00BCD4]' : 'bg-[#161B22] border border-[#30363D] text-gray-400 hover:border-gray-500'}`}
                                                >
                                                    <span>{r.emoji}</span>
                                                    <span className="font-mono text-[10px]">{r.count}</span>
                                                </button>
                                            ))}
                                            <span className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                                {['👍', '✅', '🔥'].filter(e => !msg.reactions.find(r => r.emoji === e)).map(e => (
                                                    <button key={e} onClick={() => handleReaction(msg.id, e)}
                                                        className="px-1.5 py-0.5 rounded-full text-xs bg-[#161B22] border border-[#30363D] text-gray-500 hover:border-gray-400 hover:text-gray-300 transition-all mr-1"
                                                    >
                                                        {e}
                                                    </button>
                                                ))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="px-5 py-3 border-t border-[#30363D] bg-[#0D1117]/90 backdrop-blur-sm flex-shrink-0 relative">
                    {/* Mention Dropdown */}
                    {showMentions && (
                        <div className="absolute bottom-full left-5 mb-2 w-60 bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-20">
                            <div className="px-3 py-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest border-b border-[#30363D]">Mention a member</div>
                            <div className="max-h-48 overflow-y-auto">
                                {filteredMembers.map(m => (
                                    <button key={m.id} onClick={() => insertMention(m.name)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#00BCD4]/10 transition-colors text-left"
                                    >
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: m.color + '20', color: m.color }}>
                                            {m.initials}
                                        </div>
                                        <span className="text-xs text-gray-200">{m.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSignalModal(true)}
                            className="w-10 h-10 rounded-xl bg-[#161B22] border border-[#30363D] flex items-center justify-center text-[#00BCD4] hover:bg-[#00BCD4]/10 hover:border-[#00BCD4]/30 transition-all flex-shrink-0"
                            title="Share Signal"
                        >
                            <span className="material-symbols-outlined text-lg">monitoring</span>
                        </button>
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputText}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type a message... use @ to mention"
                                className="w-full bg-[#161B22] border border-[#30363D] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00BCD4]/50 focus:ring-1 focus:ring-[#00BCD4]/20 transition-colors"
                            />
                        </div>
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputText.trim()}
                            className="w-10 h-10 rounded-xl bg-[#00BCD4] flex items-center justify-center text-white hover:bg-[#00BCD4]/80 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                        >
                            <span className="material-symbols-outlined text-lg">send</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── RIGHT SIDEBAR: Today's Signals ─── */}
            <div className={`${showMobileSignals ? 'fixed inset-0 z-50 bg-[#0D1117]' : 'hidden'} lg:block lg:relative lg:w-[250px] flex-shrink-0 border-l border-[#30363D] flex flex-col`}>
                {/* Mobile close */}
                <div className="flex items-center justify-between p-4 border-b border-[#30363D] lg:hidden">
                    <span className="text-sm font-bold">Today's Signals</span>
                    <button onClick={() => setShowMobileSignals(false)} className="text-gray-400 hover:text-white">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                <div className="p-4 border-b border-[#30363D]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today's Signals</span>
                        <span className="bg-[#00BCD4]/15 text-[#00BCD4] px-1.5 py-0.5 rounded text-[10px] font-bold">{TODAY_SIGNALS.length}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {TODAY_SIGNALS.map((s, i) => (
                        <div key={i} className="bg-[#161B22] rounded-xl border border-[#30363D] p-3 hover:border-[#30363D]/80 transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.symbol}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.action === 'BUY' ? 'bg-[#00C853]/15 text-[#00C853]' : 'bg-[#FF1744]/15 text-[#FF1744]'}`}>
                                        {s.action}
                                    </span>
                                </div>
                                <span className={`text-xs font-bold font-mono ${s.status === 'win' ? 'text-[#00C853]' : s.status === 'loss' ? 'text-[#FF1744]' : 'text-gray-400'}`}>
                                    {s.pnl}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-500">
                                <span>{s.sender}</span>
                                <span>{s.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Footer Summary */}
                <div className="p-3 border-t border-[#30363D]">
                    <div className="bg-[#161B22] rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 font-semibold">
                            Today: <span className="text-white">{TODAY_SIGNALS.length} Signals</span> | <span className="text-[#00C853]">{signalWins} ✅</span> | <span className="text-[#FF1744]">{signalLosses} ❌</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── SIGNAL COMPOSER MODAL ─── */}
            {showSignalModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSignalModal(false)}>
                    <div className="w-full max-w-md bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363D]">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#00BCD4] text-xl">monitoring</span>
                                <h3 className="text-sm font-bold text-white">Share Signal</h3>
                            </div>
                            <button onClick={() => setShowSignalModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                        {/* Modal Body */}
                        <div className="px-5 py-4 space-y-4">
                            {/* Symbol */}
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">Symbol</label>
                                <input value={signalForm.symbol} onChange={e => setSignalForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. AAPL" className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00BCD4]/50" />
                            </div>
                            {/* Action Toggle */}
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">Action</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setSignalForm(p => ({ ...p, action: 'BUY' }))}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${signalForm.action === 'BUY' ? 'bg-[#00C853] text-black' : 'bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/30'}`}>
                                        BUY
                                    </button>
                                    <button onClick={() => setSignalForm(p => ({ ...p, action: 'SELL' }))}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${signalForm.action === 'SELL' ? 'bg-[#FF1744] text-white' : 'bg-[#FF1744]/10 text-[#FF1744] border border-[#FF1744]/30'}`}>
                                        SELL
                                    </button>
                                </div>
                            </div>
                            {/* Price Fields */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">Strike Price</label>
                                    <input value={signalForm.strikePrice} onChange={e => setSignalForm(p => ({ ...p, strikePrice: e.target.value }))}
                                        placeholder="$0.00" type="number" className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00BCD4]/50 font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">Expiry Date</label>
                                    <input value={signalForm.expiry} onChange={e => setSignalForm(p => ({ ...p, expiry: e.target.value }))}
                                        placeholder="Mar 28, 2025" className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00BCD4]/50" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">Stop Loss</label>
                                    <input value={signalForm.stopLoss} onChange={e => setSignalForm(p => ({ ...p, stopLoss: e.target.value }))}
                                        placeholder="$0.00" type="number" className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FF1744] placeholder-gray-600 focus:outline-none focus:border-[#FF1744]/50 font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">Target Price</label>
                                    <input value={signalForm.target} onChange={e => setSignalForm(p => ({ ...p, target: e.target.value }))}
                                        placeholder="$0.00" type="number" className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#00C853] placeholder-gray-600 focus:outline-none focus:border-[#00C853]/50 font-mono" />
                                </div>
                            </div>
                            {/* Live R/R */}
                            <div className="bg-[#0D1117] rounded-lg border border-[#30363D] px-4 py-3 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Risk / Reward</span>
                                <span className="text-lg font-black text-[#00BCD4] font-mono">{riskReward}</span>
                            </div>
                        </div>
                        {/* Modal Footer */}
                        <div className="px-5 py-4 border-t border-[#30363D]">
                            <button onClick={handleShareSignal}
                                disabled={!signalForm.symbol || !signalForm.strikePrice}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00BCD4] to-[#00C853] text-black text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">share</span>
                                Share Signal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupChat;
