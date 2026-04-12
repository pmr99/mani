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
- **Dark theme** with vibrant chart colors

## Tech Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + Recharts + Supabase + Plaid

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier)
- A [Plaid](https://dashboard.plaid.com) account (free Development tier)

### 1. Clone and Quick Setup

```bash
git clone https://github.com/pmr99/mani.git
cd mani
chmod +x setup.sh && ./setup.sh
```

The setup script will install dependencies, prompt for your Supabase credentials, and create your `.env` file.

**Or manually:**
```bash
npm install
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings > API** and copy your **Project URL** and **anon public key**
3. Create your `.env`:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...your-key
```

### 3. Run Database Migrations

In the Supabase **SQL Editor**, run each file in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_enhancements.sql`
3. `supabase/migrations/003_investment_transactions.sql`
4. `supabase/migrations/004_cash_daily_values.sql`
5. `supabase/migrations/005_category_overrides.sql`

### 4. Set Up Plaid

1. Get your **Client ID** and **Secret** from [dashboard.plaid.com](https://dashboard.plaid.com)
2. In Supabase **Project Settings > Edge Functions > Secrets**, add:
   - `PLAID_CLIENT_ID` = your client ID
   - `PLAID_SECRET` = your secret
   - `PLAID_ENV` = `sandbox` (for testing) or `development` (for real banks)

### 5. Deploy Edge Functions

```bash
brew install supabase/tap/supabase
supabase login
export SUPABASE_ACCESS_TOKEN=your_token
supabase functions deploy --project-ref your-project-ref --no-verify-jwt --use-api
```

### 6. Start the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 7. Link Your Bank

- Click **+ Link Account** in the sidebar
- Sandbox: use `user_good` / `pass_good`
- Development: use your real bank credentials

## Free Mode vs Full Mode

Mani has a **Free Mode** toggle in the sidebar that controls API usage:

| | Free Mode | Full Mode |
|---|---|---|
| **API calls** | `/accounts/get` only (free, unlimited) | All Plaid products |
| **Balances** | ✅ Real-time | ✅ Real-time |
| **Net worth** | ✅ Tracked daily | ✅ Tracked daily |
| **Account structure** | ✅ Full | ✅ Full |
| **Transaction history** | ❌ Not available | ✅ Full history |
| **Spending analysis** | ❌ Limited | ✅ Full breakdown |
| **Investment holdings** | ❌ Totals only | ✅ Per-holding detail |
| **Monthly cost** | **$0** | ~$0.30-0.50/account |

Free Mode gives you a fully functional net worth tracker, balance dashboard, and asset distribution view — all without any Plaid costs.

## Plaid Pricing

| Product | Cost | Used By Mani |
|---------|------|-------------|
| `/accounts/get` | **Free, unlimited** | Balance refresh (Free Mode) |
| Transactions | $0.30/account/month | Transaction sync (Full Mode) |
| Investments Holdings | $0.18/account/month | Holdings detail (Full Mode) |
| Investments Transactions | $0.35/account/month | Portfolio history (Full Mode) |
| Limited Production | Free, 200 calls/product | Testing |

## License

MIT
