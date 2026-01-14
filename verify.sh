#!/bin/bash

# Configuration
# You can set these in your local .env or here

# Default environment
TARGET="dev"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --test) TARGET="test" ;;
        --prod) TARGET="prod" ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "🚀 Starting SMS Padel Sync Verification Suite ($TARGET)..."

# 1. Backend Tests
echo ""
echo "--- [1/4] Running Backend Unit Tests ---"
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
fi

# Load .env if it exists for local mapping
if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

export PYTHONPATH=$PYTHONPATH:$(pwd)/backend
export TESTING=true
export NON_INTERACTIVE=true

if [ "$TARGET" == "test" ]; then
    export TEST_ENV=true
    # Map _TEST secrets to standard names for the app code
    # We use these mappings so the core code can remain environment-agnostic
    export DATABASE_URL=${DATABASE_URL_TEST:-$DATABASE_URL}
    export SUPABASE_URL=${SUPABASE_URL_TEST:-$SUPABASE_URL}
    export SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY_TEST:-$SUPABASE_SERVICE_ROLE_KEY}
fi

# Run core logical tests
python3 -m pytest backend/tests/test_handler_logic.py backend/tests/test_matchmaking.py

if [ $? -ne 0 ]; then
    echo "❌ Backend unit tests failed!"
    exit 1
fi

# 2. E2E Scenario (If target is test)
if [ "$TARGET" == "test" ]; then
    echo ""
    echo "--- [2/4] Running E2E Scenario (non-interactive) ---"
    # Note: Using a wrapper or modified version that doesn't wait for input
    # For now, let's run it and pipe 'yes' or similar if needed, or assume it's updated.
    export TESTING=true
    python3 backend/tests/scenario_e2e_test.py <<EOF

EOF
    if [ $? -ne 0 ]; then
        echo "❌ E2E Scenario failed!"
        exit 1
    fi
    STEP=3
else
    STEP=2
fi

# 3. Frontend Linting
echo ""
echo "--- [$STEP/4] Running Frontend Linting ---"
cd frontend
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Frontend lint failed!"
    exit 1
fi
cd ..

# 4. Migration Check (Optional)
echo ""
echo "--- [$(($STEP+1))/4] Checking Pending Migrations ($TARGET) ---"
python3 scripts/migrate.py --env $TARGET --dry-run

# 5. Final Check
echo ""
echo "✅ Verification complete. System looks stable! Ready for check-in."
