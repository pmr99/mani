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

Before running setup, create accounts at:
1. [Supabase](https://supabase.com) (free tier) — get your **Project URL**, **anon key**, and **access token**
2. [Plaid](https://dashboard.plaid.com) (free) — get your **Client ID** and **Secret**
3. Install [Node.js](https://nodejs.org) 18+ and optionally [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)

### Setup (one command)

```bash
git clone https://github.com/pmr99/mani.git
cd mani
chmod +x setup.sh && ./setup.sh
```

The script handles everything interactively:
- ✅ Installs npm dependencies
- ✅ Creates `.env` with your Supabase credentials
- ✅ Runs all 5 database migrations via Supabase API
- ✅ Deploys all edge functions
- ✅ Configures Plaid secrets in Supabase

### Run

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
