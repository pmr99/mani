#!/bin/bash
# Mani — Quick Setup Script
# Run: chmod +x setup.sh && ./setup.sh

set -e

echo ""
echo "  💰 Mani — Personal Finance Tracker Setup"
echo "  ========================================="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required. Install from https://nodejs.org"; exit 1; }

echo "✅ Node.js $(node -v) found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for .env
if [ ! -f .env ]; then
  echo ""
  echo "⚙️  Setting up environment variables..."
  echo ""
  echo "You'll need:"
  echo "  1. A Supabase account → https://supabase.com (free)"
  echo "  2. A Plaid account → https://dashboard.plaid.com (free sandbox)"
  echo ""

  read -p "Enter your Supabase Project URL (https://xxx.supabase.co): " SUPABASE_URL
  read -p "Enter your Supabase anon key (eyJ...): " SUPABASE_KEY

  cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF
  echo "✅ .env created"
else
  echo "✅ .env already exists"
fi

echo ""
echo "📋 Next steps:"
echo ""
echo "  1. Run the SQL migrations in your Supabase SQL Editor:"
echo "     - supabase/migrations/001_initial_schema.sql"
echo "     - supabase/migrations/002_enhancements.sql"
echo "     - supabase/migrations/003_investment_transactions.sql"
echo "     - supabase/migrations/004_cash_daily_values.sql"
echo "     - supabase/migrations/005_category_overrides.sql"
echo ""
echo "  2. Add Plaid secrets in Supabase → Project Settings → Edge Functions → Secrets:"
echo "     - PLAID_CLIENT_ID = your Plaid client ID"
echo "     - PLAID_SECRET = your Plaid secret"
echo "     - PLAID_ENV = sandbox (or production)"
echo ""
echo "  3. Deploy edge functions:"
echo "     brew install supabase/tap/supabase"
echo "     supabase login"
echo "     export SUPABASE_ACCESS_TOKEN=your_token"
echo "     supabase functions deploy --project-ref YOUR_REF --no-verify-jwt --use-api"
echo ""
echo "  4. Start the app:"
echo "     npm run dev"
echo ""
echo "  Then open http://localhost:5173 and click '+ Link Account' to connect a bank."
echo ""
