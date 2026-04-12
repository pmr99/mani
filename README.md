# Mani - Personal Finance Tracker

A comprehensive personal finance dashboard that connects to your real bank accounts via Plaid, providing rich visualizations, spending insights, investment tracking, and net worth analysis.

## Screenshots

| Dashboard | Wealth |
|-----------|--------|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Wealth](docs/screenshots/wealth.png) |

| Transactions | Insights |
|-------------|----------|
| ![Transactions](docs/screenshots/transactions.png) | ![Insights](docs/screenshots/insights.png) |

## Features

- **Dashboard** - Savings tracking, spending analysis, investment portfolio, cash balance forecast
- **Wealth** - Net worth over time, asset distribution, liabilities breakdown
- **Transactions** - Spending charts, category/account breakdowns, recategorization
- **Insights** - Smart spending and portfolio analysis with actionable advice
- **Free Mode** - Balance-only dashboard at $0/month using free Plaid APIs
- **Dark theme** with vibrant chart colors

## Tech Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + Recharts + Supabase + Plaid

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Supabase](https://supabase.com) account (free tier)
- A [Plaid](https://dashboard.plaid.com) account (free Limited Production)

### Step 1: Clone and Setup

```bash
git clone https://github.com/pmr99/mani.git
cd mani
chmod +x setup.sh && ./setup.sh
```

The script will:
- Install npm dependencies
- Prompt for your **Supabase Project URL** and **anon key** (from [Project Settings > API](https://supabase.com/dashboard))
- Create your `.env` file

### Step 2: Configure Supabase

**a) Run database migrations** — go to your Supabase [SQL Editor](https://supabase.com/dashboard) and run each file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_enhancements.sql
supabase/migrations/003_investment_transactions.sql
supabase/migrations/004_cash_daily_values.sql
supabase/migrations/005_category_overrides.sql
```

**b) Add Plaid secrets** — in Supabase [Edge Function Secrets](https://supabase.com/dashboard), add:

| Secret | Value |
|--------|-------|
| `PLAID_CLIENT_ID` | Your Plaid client ID |
| `PLAID_SECRET` | Your Plaid secret |
| `PLAID_ENV` | `sandbox` (testing) or `production` (real banks) |

**c) Deploy edge functions:**

```bash
brew install supabase/tap/supabase
supabase login
export SUPABASE_ACCESS_TOKEN=your_token
supabase functions deploy --project-ref your-project-ref --no-verify-jwt --use-api
```

### Step 3: Run

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173), click **+ Link Account** in the sidebar, and connect your bank.

> **Sandbox testing:** use `user_good` / `pass_good` as credentials.

## Free Mode vs Full Mode

Mani auto-detects your mode. If you've synced transactions before, it defaults to Full (you're already paying per-account/month — unlimited syncs are free). New users start in Free Mode.

| | Free Mode | Full Mode |
|---|---|---|
| **Cost** | **$0/month** | ~$0.30-0.50/account/month |
| **Balances & Net Worth** | ✅ | ✅ |
| **Asset Distribution** | ✅ | ✅ |
| **Transaction History** | ❌ | ✅ |
| **Spending Analysis** | ❌ | ✅ |
| **Investment Holdings** | ❌ | ✅ |

Toggle between modes in the sidebar. Plaid charges per connected account per month (not per API call), so once active, syncing is unlimited.

## Plaid Pricing

| API | Cost | Used For |
|-----|------|----------|
| `/accounts/get` | **Free, unlimited** | Balances, net worth (Free Mode) |
| Transactions | $0.30/account/month | Spending analysis (Full Mode) |
| Investments Holdings | $0.18/account/month | Portfolio detail (Full Mode) |
| Investments Transactions | $0.35/account/month | Portfolio history (Full Mode) |

## License

MIT
