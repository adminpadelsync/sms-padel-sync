# SMS Padel Sync

An automated SMS-based padel match-making system with multi-club support and admin dashboard.

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- Supabase account
- Twilio account (for SMS)

### Initial Setup

1. **Clone and Install Dependencies**
   ```bash
   cd /Users/adamrogers/Documents/sms-padel-sync
   
   # Backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   
   # Frontend
   cd frontend
   npm install
   cd ..
   ```

2. **Configure Environment Variables**
   
   Create `backend/.env`:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_PHONE_NUMBER=your_twilio_number
   ```
   
   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Set Up Database**
   
   Run migrations in Supabase SQL Editor:
   ```bash
   # 1. Create base schema
   backend/schema.sql
   
   # 2. Add multi-tenancy
   backend/migrations/001_add_multi_tenancy.sql
   
   # 3. Fix RLS recursion
   backend/migrations/002_fix_rls_recursion.sql
   ```

4. **Disable Email Confirmation** (Development)
   - Supabase Dashboard → Authentication → Providers → Email
   - Uncheck "Confirm email"

5. **Create Your Superuser Account**
   ```bash
   # Sign up at http://localhost:3000/login
   # Then run:
   source .venv/bin/activate
   python3 backend/setup_superuser.py your-email@example.com
   ```

6. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   uvicorn main:app --reload
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

7. **Access Dashboard**
   - Navigate to http://localhost:3000
   - Login with your superuser account
   - You should see "Superuser Dashboard" with purple badge

## Project Structure

```
sms-padel-sync/
├── api/                      # Vercel serverless entry point
│   └── index.py
├── backend/
│   ├── handlers/             # SMS command handlers
│   │   ├── date_parser.py
│   │   ├── feedback_handler.py
│   │   ├── invite_handler.py
│   │   ├── match_handler.py
│   │   └── onboarding_handler.py
│   ├── migrations/           # SQL migration files
│   ├── scripts/              # Utility & seeding scripts
│   │   ├── add_sample_players.py
│   │   ├── setup_superuser.py
│   │   └── seed_club.py
│   ├── main.py               # FastAPI server
│   ├── api_routes.py         # API endpoints
│   ├── sms_handler.py        # SMS processing
│   ├── matchmaker.py         # Match-making algorithm
│   ├── match_organizer.py    # Match coordination
│   ├── database.py           # Supabase client
│   ├── twilio_client.py      # SMS sending
│   ├── redis_client.py       # State management
│   ├── error_logger.py       # Error tracking
│   └── schema.sql            # Base database schema
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── dashboard/    # Admin dashboard
│       │   ├── sms-simulator/# Testing interface
│       │   ├── login/        # Authentication
│       │   └── page.tsx      # Landing page
│       ├── components/       # Reusable UI components
│       ├── lib/              # Shared libraries
│       └── utils/            # Utility functions
├── docs/                     # Documentation
└── README.md
```

## Key Features

### Multi-Tenancy
- **Club Isolation**: Each club's data is completely separate
- **Row Level Security**: Database-enforced access control
- **Superuser Access**: View and manage all clubs
- **Club Admin Access**: Manage only their club's data

### Admin Dashboard
- **Player Management**: Create, edit, activate/deactivate players
- **Match Tracking**: View all matches with status
- **Club Selector**: Superusers can select which club to add players to
- **Summary Cards**: Quick stats on active players, matches, etc.

### SMS Integration
- **Match Requests**: Players text to request matches
- **Voting System**: Players vote on time slots
- **Automated Matching**: System finds balanced matches
- **Notifications**: SMS confirmations and updates

## Documentation

- **[Multi-Tenancy Setup](docs/MULTI_TENANCY_SETUP.md)** - Complete guide for setting up club isolation
- **[Disable Email Confirmation](docs/DISABLE_EMAIL_CONFIRMATION.md)** - Development setup
- **[Twilio Setup](docs/twilio_setup_guide.md)** - SMS integration guide
- **[Manual Verification](docs/manual_verification_guide.md)** - Testing guide

## Common Tasks

### Create a New Club
```sql
INSERT INTO clubs (name, court_count, phone_number, settings)
VALUES ('My Club', 6, '+15005550001', '{"business_hours": "8am-10pm"}');
```

### Create a Club Admin
```sql
-- Get user_id from Supabase Auth Users page
-- Get club_id from clubs table
INSERT INTO users (user_id, club_id, email, role, is_superuser)
VALUES ('user-uuid', 'club-uuid', 'admin@club.com', 'club_admin', false);
```

### Seed Test Data
```bash
source .venv/bin/activate
python3 backend/seed_club.py
```

## Troubleshooting

### "User not found in system" error
Run the superuser setup script with your email.

### Empty dashboard after login
Check that you've run all migrations and your user is in the `users` table.

### "Infinite recursion" RLS error
Run migration `002_fix_rls_recursion.sql`.

### Can't see club column
Make sure you're logged in as a superuser.

## Next Steps

- [ ] Build superuser admin panel for managing clubs/users
- [ ] Add club filter dropdown for superusers
- [ ] Implement SMS flow testing
- [ ] Add match management features
- [ ] Deploy to production

## Support

For issues or questions, check the documentation in the `docs/` folder.
