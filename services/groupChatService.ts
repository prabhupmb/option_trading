import { supabase } from './supabase';

// ─── CONSTANTS ─────────────────────────────────────────────────
const USER_COLORS = [
    '#00C853', '#2196F3', '#E040FB', '#FF9800', '#00BCD4',
    '#FF5252', '#FFD740', '#69F0AE', '#448AFF', '#FF80AB',
];

// ─── HELPERS ───────────────────────────────────────────────────
const getUserColor = (id: string): string => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

const getInitials = (name: string): string =>
    name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);

const formatTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getCurrentUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
};

// Fetch a map of user id → name from the users table
const fetchUserNames = async (ids: string[]): Promise<Map<string, string>> => {
    if (!ids.length) return new Map();
    const { data } = await supabase.from('users').select('id, display_name, full_name, user_name').in('id', ids);
    const map = new Map<string, string>();
    for (const u of data ?? []) map.set(u.id, u.display_name || u.full_name || u.user_name || 'Unknown');
    return map;
};

// ─── EXPORTED TYPES ────────────────────────────────────────────
export interface Reaction {
    emoji: string;
    count: number;
    reacted: boolean;
}

export interface SignalData {
    id: string;
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

export interface ChatMessage {
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

export interface Member {
    id: string;
    name: string;
    initials: string;
    winRate: number;
    online: boolean;
    color: string;
}

export interface TodaySignal {
    symbol: string;
    action: 'BUY' | 'SELL';
    pnl: string;
    status: 'pending' | 'win' | 'loss';
    time: string;
    sender: string;
}

export interface SignalFormData {
    symbol: string;
    action: 'BUY' | 'SELL';
    strikePrice: number;
    expiry: string;
    stopLoss: number;
    target: number;
}

// ─── FETCH MESSAGES ────────────────────────────────────────────
export const fetchMessages = async (groupId: string, limit = 50): Promise<ChatMessage[]> => {
    const userId = await getCurrentUserId();

    // Step 1: fetch messages (no join)
    const { data: msgs, error } = await supabase
        .from('group_messages')
        .select('id, sender_id, text, has_signal, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error || !msgs) return [];

    const messageIds = msgs.map((m: any) => m.id);
    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id).filter(Boolean))];
    const signalMsgIds = msgs.filter((m: any) => m.has_signal).map((m: any) => m.id);

    // Step 2: fetch user names, reactions, signals, responses in parallel
    const [userNames, reactionsRes, signalsRes] = await Promise.all([
        fetchUserNames(senderIds),
        messageIds.length
            ? supabase.from('message_reactions').select('message_id, emoji, user_id').in('message_id', messageIds)
            : Promise.resolve({ data: [] }),
        signalMsgIds.length
            ? supabase.from('group_signals').select('id, message_id, symbol, action, strike_price, stop_loss, target, expiry, rr_ratio, current_price, status, outcome_pnl').in('message_id', signalMsgIds)
            : Promise.resolve({ data: [] }),
    ]);

    const reactions = reactionsRes.data ?? [];
    const signals = signalsRes.data ?? [];
    const signalIds = signals.map((s: any) => s.id);

    const { data: responsesData } = signalIds.length
        ? await supabase.from('signal_responses').select('signal_id, response, user_id').in('signal_id', signalIds)
        : { data: [] };
    const responses = responsesData ?? [];

    return msgs.map((msg: any) => {
        const senderId: string = msg.sender_id ?? '';
        const senderName: string = userNames.get(senderId) ?? 'Unknown';

        // Aggregate reactions by emoji
        const msgReactions = reactions.filter((r: any) => r.message_id === msg.id);
        const reactionMap = new Map<string, { count: number; reacted: boolean }>();
        for (const r of msgReactions) {
            const existing = reactionMap.get(r.emoji);
            if (existing) {
                existing.count++;
                if (r.user_id === userId) existing.reacted = true;
            } else {
                reactionMap.set(r.emoji, { count: 1, reacted: r.user_id === userId });
            }
        }
        const reactionList: Reaction[] = Array.from(reactionMap.entries()).map(
            ([emoji, v]) => ({ emoji, count: v.count, reacted: v.reacted })
        );

        // Build signal if present
        let signal: SignalData | undefined;
        const msgSignal = signals.find((s: any) => s.message_id === msg.id);
        if (msg.has_signal && msgSignal) {
            const s = msgSignal;
            const sigResponses = responses.filter((r: any) => r.signal_id === s.id);
            const counts = { in: 0, skip: 0, watching: 0 };
            let myResponse: 'in' | 'skip' | 'watching' | null = null;
            for (const r of sigResponses) {
                if (r.response in counts) counts[r.response as keyof typeof counts]++;
                if (r.user_id === userId) myResponse = r.response;
            }
            signal = {
                id: s.id,
                symbol: s.symbol,
                action: s.action as 'BUY' | 'SELL',
                strikePrice: s.strike_price,
                expiry: s.expiry,
                stopLoss: s.stop_loss,
                target: s.target,
                riskReward: s.rr_ratio ?? '-',
                currentPrice: s.current_price ?? s.strike_price,
                responses: counts,
                myResponse,
            };
        }

        return {
            id: msg.id,
            senderId,
            senderName,
            senderInitials: getInitials(senderName),
            senderColor: getUserColor(senderId),
            text: msg.text ?? '',
            timestamp: formatTime(msg.created_at),
            reactions: reactionList,
            signal,
        };
    });
};

// ─── SEND MESSAGE ──────────────────────────────────────────────
export const sendMessage = async (groupId: string, text: string): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('group_messages')
        .insert({ group_id: groupId, sender_id: userId, text, has_signal: false });

    if (error) throw error;
};

// ─── SEND SIGNAL ───────────────────────────────────────────────
export const sendSignal = async (groupId: string, signal: SignalFormData): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const risk = Math.abs(signal.strikePrice - signal.stopLoss);
    const reward = Math.abs(signal.target - signal.strikePrice);
    const rrRatio = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : '-';

    // Insert message row first
    const { data: msg, error: msgError } = await supabase
        .from('group_messages')
        .insert({ group_id: groupId, sender_id: userId, text: '', has_signal: true })
        .select('id')
        .single();

    if (msgError || !msg) throw msgError ?? new Error('Failed to create message');

    // Then insert signal row
    const { error: sigError } = await supabase
        .from('group_signals')
        .insert({
            message_id: msg.id,
            group_id: groupId,
            sender_id: userId,
            symbol: signal.symbol,
            action: signal.action,
            strike_price: signal.strikePrice,
            stop_loss: signal.stopLoss,
            target: signal.target,
            expiry: signal.expiry,
            rr_ratio: rrRatio,
            current_price: signal.strikePrice,
            status: 'pending',
        });

    if (sigError) throw sigError;
};

// ─── SIGNAL RESPONSE ──────────────────────────────────────────
export const setSignalResponse = async (
    signalId: string,
    response: 'in' | 'skip' | 'watching'
): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const { data: existing } = await supabase
        .from('signal_responses')
        .select('id, response')
        .eq('signal_id', signalId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing?.response === response) {
        // Same response clicked — toggle off
        await supabase.from('signal_responses').delete().eq('id', existing.id);
    } else {
        const { error } = await supabase
            .from('signal_responses')
            .upsert(
                { signal_id: signalId, user_id: userId, response },
                { onConflict: 'signal_id,user_id' }
            );
        if (error) throw error;
    }
};

// ─── TOGGLE REACTION ──────────────────────────────────────────
export const toggleReaction = async (messageId: string, emoji: string): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

    if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
        const { error } = await supabase
            .from('message_reactions')
            .insert({ message_id: messageId, user_id: userId, emoji });
        if (error) throw error;
    }
};

// ─── FETCH MEMBERS ────────────────────────────────────────────
export const fetchMembers = async (groupId: string): Promise<Member[]> => {
    const userId = await getCurrentUserId();

    // Step 1: get member ids (no join)
    const { data, error } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

    if (error || !data) return [];

    const memberIds = data.map((m: any) => m.user_id);

    // Step 2: fetch names + signals in parallel
    const [userNames, signalsRes] = await Promise.all([
        fetchUserNames(memberIds),
        memberIds.length
            ? supabase.from('group_signals').select('sender_id, status').eq('group_id', groupId).in('sender_id', memberIds).in('status', ['win', 'loss'])
            : Promise.resolve({ data: [] }),
    ]);

    const signals = signalsRes.data ?? [];

    return data.map((m: any) => {
        const id: string = m.user_id;
        const name: string = userNames.get(id) ?? 'Unknown';
        const memberSignals = signals.filter((s: any) => s.sender_id === id);
        const wins = memberSignals.filter((s: any) => s.status === 'win').length;
        const winRate = memberSignals.length > 0 ? Math.round((wins / memberSignals.length) * 100) : 0;

        return {
            id,
            name,
            initials: getInitials(name),
            winRate,
            online: id === userId,
            color: getUserColor(id),
        };
    });
};

// ─── FETCH TODAY'S SIGNALS ────────────────────────────────────
export const fetchTodaySignals = async (groupId: string): Promise<TodaySignal[]> => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('group_signals')
        .select('symbol, action, status, outcome_pnl, created_at, sender_id')
        .eq('group_id', groupId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true });

    if (error || !data) return [];

    const senderIds = [...new Set(data.map((s: any) => s.sender_id).filter(Boolean))];
    const userNames = await fetchUserNames(senderIds);

    return data.map((s: any) => {
        const senderName: string = userNames.get(s.sender_id) ?? 'Unknown';
        const parts = senderName.split(' ').filter(Boolean);
        const senderAbbrev = parts.length > 1
            ? `${parts[0]} ${parts[parts.length - 1][0]}.`
            : parts[0] ?? 'Unknown';

        return {
            symbol: s.symbol,
            action: s.action as 'BUY' | 'SELL',
            pnl: s.outcome_pnl ?? 'Pending',
            status: (s.status ?? 'pending') as 'pending' | 'win' | 'loss',
            time: formatTime(s.created_at),
            sender: senderAbbrev,
        };
    });
};

// ─── SUBSCRIBE TO MESSAGES ────────────────────────────────────
// Hands back a fully-enriched ChatMessage ready to append
export const subscribeToMessages = (
    groupId: string,
    onNewMessage: (msg: ChatMessage) => void
): (() => void) => {
    const channel = supabase
        .channel(`messages_${groupId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
            async (payload) => {
                const msgId = payload.new.id as string;
                const hasSignal = payload.new.has_signal as boolean;

                // For signal messages, wait briefly so the group_signals row is committed
                if (hasSignal) await new Promise(r => setTimeout(r, 800));

                const all = await fetchMessages(groupId);
                const enriched = all.find(m => m.id === msgId);
                if (enriched) onNewMessage(enriched);
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── SUBSCRIBE TO REACTIONS ───────────────────────────────────
// Fires "something changed" — caller should re-fetch affected messages
export const subscribeToReactions = (
    _groupId: string,
    onUpdate: () => void
): (() => void) => {
    const channel = supabase
        .channel(`reactions_${_groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => onUpdate())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── SUBSCRIBE TO SIGNAL RESPONSES ───────────────────────────
// Fires "something changed" — caller should re-fetch affected messages
export const subscribeToSignalResponses = (
    _groupId: string,
    onUpdate: () => void
): (() => void) => {
    const channel = supabase
        .channel(`responses_${_groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'signal_responses' }, () => onUpdate())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── PRESENCE ─────────────────────────────────────────────────
// Tracks who is currently online in the group chat room
export const subscribeToPresence = (
    groupId: string,
    userId: string,
    onPresenceChange: (onlineIds: Set<string>) => void
): (() => void) => {
    const channel = supabase.channel(`presence_${groupId}`, {
        config: { presence: { key: userId } },
    });

    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const ids = new Set(Object.keys(state));
            onPresenceChange(ids);
        })
        .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: userId, online_at: new Date().toISOString() });
            }
        });

    return () => { supabase.removeChannel(channel); };
};
