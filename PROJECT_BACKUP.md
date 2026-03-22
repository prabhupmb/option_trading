# Option Trading Platform — Project Backup & Reference Guide

> **Purpose:** This document serves as a complete reference for new sessions. It covers user creation, trading strategies, table structures, and N8n workflows.
> **Last Updated:** 2026-03-22

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [User Creation & Authentication Flow](#user-creation--authentication-flow)
4. [Database Table Structures](#database-table-structures)
5. [Trading Strategies](#trading-strategies)
6. [N8n Workflow Integration](#n8n-workflow-integration)
7. [Access Levels & Roles](#access-levels--roles)
8. [Broker Integration](#broker-integration)
9. [Auto-Refresh Schedule](#auto-refresh-schedule)
10. [Key Configuration](#key-configuration)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase OAuth (Google) |
| Automation | N8n (workflow platform) |
| AI Analysis | Google Gemini API |
| Data Source | Google Sheets API |
| Brokers | Alpaca, Schwab, IBKR |

---

## Project Structure

```
/option_trading
├── components/
│   ├── settings/            # Broker settings, configuration
│   ├── signals/             # Signal filtering, display, watchlist
│   ├── layout/              # Layout components
│   ├── quicktrade/          # Quick trade modal
│   ├── ExecuteTradeModal.tsx    # Options/stocks execution
│   ├── IronGateTracker.tsx      # Iron Gate swing tracker
│   ├── IronGateDayTracker.tsx   # Iron Gate day trading
│   ├── StockGateTracker.tsx     # Stock trading tracker
│   ├── Portfolio.tsx            # Positions & account
│   ├── LoginPage.tsx            # Google OAuth login
│   ├── SignupForm.tsx           # New user registration
│   ├── AdminPanel.tsx           # Admin management
│   └── GroupChat.tsx            # Real-time group chat
├── services/
│   ├── useAuth.ts           # Auth + user verification
│   ├── supabase.ts          # Supabase client
│   ├── n8n.ts               # N8n webhook calls
│   └── googleSheets.ts      # Google Sheets fetcher
├── hooks/
│   ├── useOptionSignals.ts  # Fetch signals from Supabase
│   ├── useBrokers.ts        # Broker credentials
│   ├── useStrategyConfigs.ts # Strategy config
│   ├── useScanProgress.ts   # Scan progress state
│   └── useQuickTrade.ts     # Quick trade state
├── context/
│   └── BrokerContext.tsx    # Selected broker state
├── utils/
│   └── tradeUtils.ts        # Currency formatting, date utils
├── types.ts                 # TypeScript interfaces & enums
├── constants.ts             # Default data & constants
├── App.tsx                  # Main app + routing
└── .agent/workflows/
    └── add-new-strategy.md  # How to add a new strategy
```

---

## User Creation & Authentication Flow

### Step-by-Step Flow

```
1. User opens app
       ↓
2. useAuth() checks Supabase session
       ↓
   [No session] → Show LoginPage (Google OAuth button)
       ↓
3. User clicks "Continue with Google"
       ↓
4. Supabase OAuth redirect → Google login → callback
       ↓
5. verifyUser() runs in useAuth.ts:
       ↓
   ┌─────────────────────────────────────────┐
   │ Check: Is email in users table?         │
   ├─────────────────────────────────────────┤
   │ YES → load profile, check trial status  │
   │ NO  → call N8n /webhook/verify-user     │
   └─────────────────────────────────────────┘
       ↓ (if NO)
6. N8n verifies if email is pre-approved
       ↓
   ┌──────────────────────────────────────────────┐
   │ allowed=true  → show SignupForm              │
   │ not_registered → show SignupForm             │
   │ denied        → show access denied screen   │
   └──────────────────────────────────────────────┘
       ↓ (if allowed)
7. User fills SignupForm:
   - userName, fullName, phone (optional)
       ↓
8. POST to N8n /webhook/register-user
       ↓
9. User status = "pending" (awaiting admin approval)
       ↓
10. Admin sees request in AdminPanel
        ↓
11. Admin clicks Approve → POST /webhook/approve-user
        ↓
12. users table: is_active=true, access_level='signal'
        ↓
13. User can now log in with signal access
```

### Trial System

- **Duration:** 30 days from account creation
- **Eligible:** All non-admin users with access_level != 'trade'
- **On Expiry:** Show trial_expired screen with upgrade CTA
- **Check:** `getTrialDaysLeft(user.created_at)` in useAuth.ts

### Auth State Values

| Status | Meaning |
|--------|---------|
| `loading` | Auth check in progress |
| `allowed` | User is verified and active |
| `signup` | New user, needs to register |
| `pending` | Registered, awaiting admin approval |
| `denied` | Access not granted |
| `trial_expired` | 30-day trial ended |

---

## Database Table Structures

### `users` Table

```sql
id            UUID PRIMARY KEY
email         TEXT UNIQUE NOT NULL
name          TEXT
full_name     TEXT
user_name     TEXT
username      TEXT
role          TEXT  -- 'admin' | 'customer'
access_level  TEXT  -- 'signal' | 'paper' | 'trade'
is_active     BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ DEFAULT now()
```

### `broker_credentials` Table

```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
broker_name     TEXT  -- 'alpaca' | 'schwab' | 'ibkr'
display_name    TEXT
broker_mode     TEXT  -- 'paper' | 'live'
is_active       BOOLEAN DEFAULT true
is_default      BOOLEAN DEFAULT false
api_key         TEXT
api_secret      TEXT
access_token    TEXT
refresh_token   TEXT
token_expires_at TIMESTAMPTZ
account_id      TEXT
base_url        TEXT
settings        JSONB
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### `upgrade_requests` Table

```sql
id               BIGINT PRIMARY KEY
user_id          UUID REFERENCES users(id)
email            TEXT
full_name        TEXT
current_level    TEXT  -- current access_level
requested_level  TEXT  -- desired access_level
request_source   TEXT
message          TEXT
status           TEXT  -- 'pending' | 'approved' | 'rejected'
reviewed_by      UUID
review_note      TEXT
reviewed_at      TIMESTAMPTZ
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### `strategy_configs` Table

```sql
id           UUID PRIMARY KEY
strategy     TEXT  -- 'swing_trade' | 'day_trade' | 'iron_gate' | etc.
display_name TEXT
icon         TEXT  -- Material icon name
is_active    BOOLEAN DEFAULT true
params       JSONB  -- { scan_times: [], min_gates: N, min_tier: 'A+', ... }
```

### `strategy_watchlists` Table

```sql
id         UUID PRIMARY KEY
strategy   TEXT  -- Strategy key
symbol     TEXT  -- Stock ticker
created_at TIMESTAMPTZ
```

---

### Signal Tables

#### `swing_trade` Table

```sql
id                    UUID PRIMARY KEY
symbol                TEXT
current_price         NUMERIC
option_type           TEXT  -- 'CALL' | 'PUT' | 'NO_TRADE'
tier                  TEXT  -- 'A+' | 'A' | 'B+' | 'NO_TRADE'
signal                TEXT
trading_recommendation TEXT  -- 'STRONG BUY' | 'BUY' | 'SELL' | etc.
gates_passed          TEXT  -- e.g., '4/5'
adx_value             NUMERIC
adx_trend             TEXT  -- 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK'
sma_direction         TEXT  -- 'UP' | 'DOWN' | 'Neutral'
fib_target1           NUMERIC
fib_target2           NUMERIC
fib_stop_loss         NUMERIC
target1               NUMERIC
target2               NUMERIC
stop_loss             NUMERIC
profit_zone_label     TEXT
risk_reward_ratio     TEXT  -- e.g., '1.5:1'
analyzed_at           TIMESTAMPTZ
ai_entry_hint         TEXT
ai_reason             TEXT
is_latest             BOOLEAN DEFAULT true
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

#### `day_trade` Table

```sql
id                    UUID PRIMARY KEY
symbol                TEXT
current_price         NUMERIC
option_type           TEXT
tier                  TEXT
signal                TEXT
trading_recommendation TEXT
gates_passed          TEXT
adx_value             NUMERIC
target1               NUMERIC
target2               NUMERIC
stop_loss             NUMERIC
profit_zone_label     TEXT
ai_entry_hint         TEXT
ai_reason             TEXT
is_latest             BOOLEAN DEFAULT true
analyzed_at           TIMESTAMPTZ
created_at            TIMESTAMPTZ
```

#### `mp_signals` Table (Market Profile)

```sql
id           UUID PRIMARY KEY
ticker       TEXT
current_price NUMERIC
direction    TEXT  -- 'LONG' | 'SHORT' | 'BULLISH' | 'BEARISH'
signal_type  TEXT  -- 'STRONG BUY' | 'BUY' | 'SELL' | 'STRONG SELL'
tier         TEXT
gates_passed INTEGER
target       NUMERIC
stop         NUMERIC
poc          NUMERIC  -- Point of Control
risk_reward  TEXT
signal_time  TEXT
profile_date DATE
created_at   TIMESTAMPTZ
```

---

### Position Tracking Tables

#### `iron_gate_positions` Table (Swing Options)

```sql
id                   UUID PRIMARY KEY
symbol               TEXT
option_type          TEXT  -- 'CALL' | 'PUT'
tier                 TEXT  -- 'A+' | 'A' | 'B+'
status               TEXT  -- 'OPEN' | 'CLOSED'
signal               TEXT
trading_recommendation TEXT
entry_price          NUMERIC
target_price         NUMERIC  -- Fib Target 1
stop_loss            NUMERIC
profit_zone_low      NUMERIC
profit_zone_high     NUMERIC
fib_target1          NUMERIC
fib_target2          NUMERIC
risk_reward_ratio    TEXT
gates_passed         TEXT
adx_value            NUMERIC
adx_trend            TEXT
sma_direction        TEXT

-- Technical Indicators
plus_di              NUMERIC  -- ADX+ DI
minus_di             NUMERIC  -- ADX- DI
vwap_value           NUMERIC
vwap_trend           TEXT
vwap_position        TEXT
vwap_distance        NUMERIC
sma20                NUMERIC
sma50                NUMERIC
sma_spread           NUMERIC

-- SuperTrend
st_1h_direction      TEXT
st_1h_value          NUMERIC
st_15m_direction     TEXT
st_15m_value         NUMERIC
st_5m_direction      TEXT
st_5m_value          NUMERIC

-- Gate Status
g1_sma               TEXT
g2_1h                TEXT
g3_15m               TEXT
g4_5m                TEXT
g5_vwap              TEXT
g6_adx               TEXT
gate_reason          TEXT
trade_direction      TEXT
consensus_vote       TEXT

-- Position Tracking
opened_at            TIMESTAMPTZ
source               TEXT
version              TEXT
current_price        NUMERIC
progress_pct         NUMERIC  -- % towards target
high_water_mark      NUMERIC
low_water_mark       NUMERIC
last_checked_at      TIMESTAMPTZ
check_count          INTEGER

-- Close Data
closed_at            TIMESTAMPTZ
close_reason         TEXT
pnl_dollars          NUMERIC
pnl_pct              NUMERIC
```

#### `iron_gate_day_positions` Table

Same structure as `iron_gate_positions` — intraday variant.

#### `stock_gate_positions` Table

```sql
-- Same structure as iron_gate_positions but for stocks
trade_direction TEXT  -- 'BUY' | 'SHORT' (instead of option_type CALL/PUT)
-- No option_type field
```

#### `iron_gate_history` Table

```sql
id               UUID PRIMARY KEY
position_id      UUID  -- References iron_gate_positions.id
symbol           TEXT
option_type      TEXT
tier             TEXT
entry_price      NUMERIC
exit_price       NUMERIC
pnl_pct          NUMERIC
pnl_dollars      NUMERIC
result           TEXT  -- 'WIN' | 'LOSS' | 'BREAK_EVEN'
exit_reason      TEXT  -- 'TARGET' | 'STOP_LOSS' | 'MANUAL'
duration_minutes INTEGER
high_water_mark  NUMERIC
low_water_mark   NUMERIC
opened_at        TIMESTAMPTZ
closed_at        TIMESTAMPTZ
gates_passed     TEXT
```

#### `stock_gate_history` Table

Same structure as `iron_gate_history` for stock trades.

---

### Table Summary

| Table | Strategy | Purpose | Key Status Field |
|-------|----------|---------|-----------------|
| `swing_trade` | swing_trade | Mid-term option signals | `is_latest` |
| `day_trade` | day_trade | Intraday option signals | `is_latest` |
| `mp_signals` | market_profile | Market profile signals | `profile_date` |
| `iron_gate_positions` | iron_gate | Swing option positions | `status` (OPEN/CLOSED) |
| `iron_gate_day_positions` | iron_gate_day | Day option positions | `status` (OPEN/CLOSED) |
| `stock_gate_positions` | stock_gate | Stock positions | `status` (OPEN/CLOSED) |
| `iron_gate_history` | iron_gate | Closed swing trades | — |
| `stock_gate_history` | stock_gate | Closed stock trades | — |
| `users` | Auth | User accounts | `is_active` |
| `broker_credentials` | Auth | Broker connections | `is_active` |
| `strategy_configs` | Config | Strategy settings | `is_active` |
| `strategy_watchlists` | Config | Per-strategy watchlist | — |
| `upgrade_requests` | Admin | Access upgrade requests | `status` |

---

## Trading Strategies

### 1. Swing Trade (`swing_trade`)

- **Table:** `swing_trade` where `is_latest = true`
- **Instruments:** Options (CALL / PUT)
- **Indicators:** ADX, SMA, Fibonacci levels, Gates (4/5 or 5/5)
- **Tiers:** A+ > A > B+ > NO_TRADE
- **Scan Trigger:** POST `/webhook/scan-options`
- **Scan Times (CST):** 08:31, 08:45, 09:00, 09:10, 09:20, 09:35, 09:50, 10:15, 10:45, 12:10, 13:30, 14:15, 14:50
- **Component:** Signals screen → strategy selector
- **Targets:** `fib_target1`, `fib_target2`; Stop: `fib_stop_loss`

### 2. Day Trade (`day_trade`)

- **Table:** `day_trade` where `is_latest = true`
- **Instruments:** Options (CALL / PUT), intraday
- **Scan Trigger:** POST `/webhook/refresh-daytrade`
- **Auto Refresh:** 1 min before noon, 15 min after noon
- **Component:** Signals screen → day_trade strategy

### 3. Iron Gate (`iron_gate`)

- **Table:** `iron_gate_positions` where `status = 'OPEN'`
- **Instruments:** Options (CALL / PUT), swing positions
- **Tracking:** Entry price, Target, Stop, Progress %, High/Low watermarks
- **History:** `iron_gate_history` (closed trades)
- **Component:** `IronGateTracker.tsx`
- **Gates:** g1_sma, g2_1h, g3_15m, g4_5m, g5_vwap, g6_adx

### 4. Iron Gate Day (`iron_gate_day`)

- **Table:** `iron_gate_day_positions` where `status = 'OPEN'`
- **Instruments:** Options, intraday variant of Iron Gate
- **Component:** `IronGateDayTracker.tsx`

### 5. Stock Gate (`stock_gate`)

- **Table:** `stock_gate_positions` where `status = 'OPEN'`
- **Instruments:** Stocks (BUY long or SHORT)
- **History:** `stock_gate_history`
- **Component:** `StockGateTracker.tsx`

### 6. Market Profile (`market_profile`)

- **Table:** `mp_signals`
- **Filter:** Today's `profile_date` first, fallback to latest
- **Key Field:** POC (Point of Control)
- **Component:** Signals screen → market_profile strategy

### Signal Table Mapping

```typescript
const STRATEGY_TABLE_MAP = {
    day_trade:     'day_trade',
    swing_trade:   'swing_trade',
    market_profile: 'mp_signals',
    iron_gate:     'iron_gate_positions',
    iron_gate_day: 'iron_gate_day_positions',
};
```

### ADX Trend Thresholds

| ADX Value | Trend |
|-----------|-------|
| >= 40 | VERY_STRONG |
| >= 30 | STRONG |
| >= 20 | MODERATE |
| >= 15 | WEAK |
| < 15 | NO_TREND |

---

## N8n Workflow Integration

**Base URL:** `https://prabhupadala01.app.n8n.cloud`

### Authentication Webhooks

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/webhook/verify-user` | POST | Check if new user email is pre-approved | Bearer token |
| `/webhook/register-user` | POST | Create new pending user | Bearer token |
| `/webhook/approve-user` | POST | Admin approves user account | Bearer token |
| `/webhook/upgrade-user` | POST | Change user access level | Bearer token |

**verify-user Response:**
```json
{
  "allowed": true,
  "email": "user@example.com",
  "fullName": "John Doe",
  "avatarUrl": "https://..."
}
```

**register-user Request Body:**
```json
{
  "userName": "johndoe",
  "fullName": "John Doe",
  "email": "user@example.com",
  "phone": "+1234567890"
}
```

### Trading Scan Webhooks

| Endpoint | Method | Purpose | Trigger |
|----------|--------|---------|---------|
| `/webhook/scan-options` | POST | Run swing trade scan | Manual or scheduled |
| `/webhook/refresh-daytrade` | POST | Run day trade scan | Manual or auto-refresh |

### Portfolio Webhook

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook/portfolio-dashboard` | GET | Fetch live portfolio data |

**portfolio-dashboard Response:**
```json
{
  "success": true,
  "timestamp": "2026-03-22T10:00:00Z",
  "account": {
    "equity": 50000,
    "buyingPower": 25000,
    "cash": 10000,
    "dayPL": 500,
    "dayPLPercent": 1.0,
    "totalPL": 2500
  },
  "positions": [
    {
      "symbol": "AAPL240315C00190000",
      "underlyingTicker": "AAPL",
      "isOption": true,
      "optionType": "CALL",
      "qty": 2,
      "avgEntryPrice": 3.50,
      "currentPrice": 4.25,
      "unrealizedPL": 150,
      "unrealizedPLPercent": 21.43
    }
  ]
}
```

---

## Access Levels & Roles

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full access, can manage users |
| `customer` | Regular user |

### Access Levels

| Level | Can Do |
|-------|--------|
| `signal` | View trading signals only |
| `paper` | View signals + paper trade |
| `trade` | Full trading + signals |

### Admin Panel Actions

- Approve/reject new user registrations
- Activate/deactivate user accounts
- Upgrade user access levels (signal → paper → trade)
- Review upgrade requests with notes

---

## Broker Integration

### Supported Brokers

| Broker | Paper Trading | Live Trading | Auth Method |
|--------|--------------|--------------|-------------|
| Alpaca | Yes | Yes | API Key + Secret |
| Schwab | No | Yes | OAuth tokens |
| IBKR | No | Yes | Account ID |

### Broker Credential Storage

- Stored encrypted in `broker_credentials` table
- One default broker per user (`is_default = true`)
- Multiple brokers per user supported
- Paper/Live mode toggle per credential

---

## Auto-Refresh Schedule

```
Market Hours: 9:30 AM – 4:00 PM ET, Mon–Fri

Before 9:30 AM or after 4:00 PM ET:  No refresh
Weekends:                              No refresh

9:30 AM – 12:00 PM ET:
  - day_trade strategy:   Every 1 minute
  - All other strategies: Every 3 minutes

12:00 PM – 4:00 PM ET:
  - All strategies:       Every 15 minutes
```

---

## Key Configuration

### Environment Variables (.env)

```env
VITE_API_KEY=<google_gemini_api_key>
VITE_WEBHOOK_APPROVE_USER=https://prabhupadala01.app.n8n.cloud/webhook/approve-user
VITE_WEBHOOK_UPGRADE_USER=https://prabhupadala01.app.n8n.cloud/webhook/upgrade-user
```

### Supabase

```
URL:      https://npwnnlxhdpvgfdpvrohi.supabase.co
Anon Key: (in supabase.ts)
```

### Google Sheets Data Source

```
Sheet ID: 1Ncb-35Ro4wS3RFRA_lgTMZESZvz2uvoGTPPKYCSkhi0
Auto-refresh: every 30 seconds
Fallback: cached data on failure
```

---

## How to Add a New Strategy

See `.agent/workflows/add-new-strategy.md` for the full guide. Summary:

1. Add a row to `strategy_configs` table in Supabase
2. Create new Supabase table for signals (follow `swing_trade` schema)
3. Add table name to `STRATEGY_TABLE_MAP` in `useOptionSignals.ts`
4. Add mapper function `mapXxxToSignal()` in `useOptionSignals.ts`
5. Add N8n webhook endpoint if scan trigger needed
6. Add component if custom tracker view needed
7. Update `types.ts` with new strategy type if needed

---

*This file was auto-generated from codebase exploration on 2026-03-22.*
