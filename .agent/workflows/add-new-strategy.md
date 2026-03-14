---
description: How to add a new strategy to the Option Feed page
---

# Adding a New Strategy

When adding a new strategy to the platform, follow these steps to ensure data loads correctly from the right Supabase table.

## Step 1: Update `STRATEGY_TABLE_MAP` in `useOptionSignals.ts`

File: `hooks/useOptionSignals.ts`

Add your new strategy → table mapping to `STRATEGY_TABLE_MAP`:

```typescript
const STRATEGY_TABLE_MAP: Record<string, string> = {
    day_trade: 'day_trade',
    swing_trade: 'swing_trade',
    market_profile: 'mp_signals',
    iron_gate: 'iron_gate_positions',
    // ADD NEW STRATEGY HERE:
    // your_strategy: 'your_supabase_table',
};
```

## Step 2: Create a Data Mapper Function

Each strategy table has different column names. Create a mapper function in `useOptionSignals.ts` that converts rows to `OptionSignal`:

```typescript
const mapYourStrategyToSignal = (row: any): OptionSignal => ({
    id: String(row.id),
    symbol: row.symbol,
    current_price: Number(row.current_price) || 0,
    option_type: row.option_type?.toUpperCase() || 'NO_TRADE',
    tier: row.tier || 'NO_TRADE',
    trading_recommendation: row.recommendation || '',
    gates_passed: row.gates_passed || '0/6',
    adx_value: 0,
    adx_trend: 'NO_TREND',
    fib_target1: Number(row.target_price) || 0,
    fib_target2: 0,
    fib_stop_loss: Number(row.stop_loss) || 0,
    risk_reward_ratio: '-',
    analyzed_at: row.created_at,
});
```

## Step 3: Add Custom Query Logic (if needed)

In `fetchSignals()`, add an `else if` block for your strategy if it needs custom query logic (e.g., different filters, ordering):

```typescript
} else if (strategyFilter === 'your_strategy') {
    const result = await supabase
        .from(strategyTable)
        .select('*')
        .eq('status', 'OPEN')  // custom filter
        .order('created_at', { ascending: false });
    data = result.data || [];
    queryError = result.error;
}
```

## Step 4: Add to Mapper Switch

Add your strategy to the mapping chain in `fetchSignals()`:

```typescript
const mapped = strategyFilter === 'day_trade'
    ? data.map(mapDayTradeToSignal)
    : strategyFilter === 'market_profile'
        ? data.map(mapMpSignalToOptionSignal)
        : strategyFilter === 'iron_gate'
            ? data.map(mapIronGateToSignal)
            : strategyFilter === 'your_strategy'
                ? data.map(mapYourStrategyToSignal)
                : (data as OptionSignal[]);
```

## Step 5: Add Strategy Config in Supabase

Ensure a row exists in `strategy_configs` table:
```sql
INSERT INTO strategy_configs (strategy, display_name, icon, is_active, params)
VALUES ('your_strategy', 'Your Strategy', 'icon_name', true, '{}');
```

## Current Strategy Map Reference

| Strategy Key     | Supabase Table          | Mapper Function            |
|-----------------|------------------------|---------------------------|
| `swing_trade`   | `swing_trade`          | Direct cast (columns match) |
| `day_trade`     | `day_trade`            | `mapDayTradeToSignal`      |
| `market_profile`| `mp_signals`           | `mapMpSignalToOptionSignal`|
| `iron_gate`     | `iron_gate_positions`  | `mapIronGateToSignal`      |
