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
command -v curl >/dev/null 2>&1 || { echo "❌ curl is required."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "⚠️  jq not found. Install with: brew install jq (needed for auto-migration)"; }

echo "✅ Node.js $(node -v) found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Supabase credentials
echo ""
echo "⚙️  Supabase Configuration"
echo "  Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"
echo ""

if [ -f .env ]; then
  echo "  .env already exists. Reading existing values..."
  SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d= -f2)
  SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d= -f2)
  echo "  URL: $SUPABASE_URL"
else
  read -p "  Supabase Project URL (https://xxx.supabase.co): " SUPABASE_URL
  read -p "  Supabase anon key (eyJ...): " SUPABASE_KEY

  cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF
  echo "  ✅ .env created"
fi

# Extract project ref from URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')
echo ""
echo "  Project ref: $PROJECT_REF"

# Supabase access token for API calls
echo ""
echo "🔑 Supabase Access Token"
echo "  Generate one at: https://supabase.com/dashboard/account/tokens"
echo ""
read -p "  Supabase access token (sbp_...): " SUPABASE_TOKEN

if [ -z "$SUPABASE_TOKEN" ]; then
  echo "  ⚠️  No token provided. Skipping auto-migration."
  echo "  You'll need to run migrations manually in the SQL Editor."
else
  # Run migrations via Management API
  echo ""
  echo "🗃️  Running database migrations..."

  MIGRATIONS=(
    "supabase/migrations/001_initial_schema.sql"
    "supabase/migrations/002_enhancements.sql"
    "supabase/migrations/003_investment_transactions.sql"
    "supabase/migrations/004_cash_daily_values.sql"
    "supabase/migrations/005_category_overrides.sql"
  )

  for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$migration" ]; then
      echo "  Running $migration..."
      SQL=$(cat "$migration")
      RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
        -H "Authorization: Bearer $SUPABASE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg sql "$SQL" '{query: $sql}')" 2>&1)

      if echo "$RESPONSE" | grep -q "error"; then
        echo "  ⚠️  Warning on $migration: $RESPONSE"
      else
        echo "  ✅ $migration"
      fi
    fi
  done

  # Deploy edge functions
  echo ""
  echo "🚀 Deploying edge functions..."

  # Check if supabase CLI is installed
  if command -v supabase >/dev/null 2>&1; then
    export SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN"
    supabase functions deploy --project-ref "$PROJECT_REF" --no-verify-jwt --use-api 2>&1 && echo "  ✅ Edge functions deployed" || echo "  ⚠️  Deploy failed. Try manually: supabase functions deploy --project-ref $PROJECT_REF --no-verify-jwt --use-api"
  else
    echo "  Supabase CLI not found. Install with: brew install supabase/tap/supabase"
    echo "  Then run:"
    echo "    export SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN"
    echo "    supabase functions deploy --project-ref $PROJECT_REF --no-verify-jwt --use-api"
  fi

  # Plaid secrets
  echo ""
  echo "🏦 Plaid Configuration"
  echo "  Get keys from: https://dashboard.plaid.com/team/keys"
  echo ""
  read -p "  Plaid Client ID: " PLAID_CLIENT_ID
  read -p "  Plaid Secret: " PLAID_SECRET
  read -p "  Plaid Environment (sandbox/production) [sandbox]: " PLAID_ENV
  PLAID_ENV=${PLAID_ENV:-sandbox}

  if [ -n "$PLAID_CLIENT_ID" ] && [ -n "$PLAID_SECRET" ]; then
    echo "  Setting Plaid secrets in Supabase..."

    for SECRET_NAME in PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV; do
      eval SECRET_VALUE=\$$SECRET_NAME
      curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/secrets" \
        -H "Authorization: Bearer $SUPABASE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "[{\"name\": \"$SECRET_NAME\", \"value\": \"$SECRET_VALUE\"}]" > /dev/null 2>&1
    done
    echo "  ✅ Plaid secrets configured"
  else
    echo "  ⚠️  Skipped. Add Plaid secrets manually in Supabase Edge Function Secrets."
  fi
fi

echo ""
echo "  ✅ Setup complete!"
echo ""
echo "  Start the app:"
echo "    npm run dev"
echo ""
echo "  Then open http://localhost:5173"
echo "  Click '+ Link Account' in the sidebar to connect a bank."
echo "  Sandbox test credentials: user_good / pass_good"
echo ""
