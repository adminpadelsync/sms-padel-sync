# Quick Reference - Start Here Next Session

## 🚀 Start Development Servers

```bash
# Terminal 1 - Backend
cd /Users/adamrogers/Documents/sms-padel-sync/backend
source ../.venv/bin/activate
uvicorn main:app --reload --port 8001

# Terminal 2 - Frontend  
cd /Users/adamrogers/Documents/sms-padel-sync/frontend
npm run dev
```

## 🔑 Access Points

- **Dashboard:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **Supabase:** https://supabase.com/dashboard

## 📋 What's Working

✅ Multi-tenancy with club isolation  
✅ Superuser and club admin roles  
✅ Player management (create, edit, activate/deactivate)  
✅ Dashboard with summary cards  
✅ Club visibility for superusers  
✅ Logout functionality  

## 🎯 Next Priorities

1. **SMS Testing** - Test the Twilio integration
2. **Superuser Admin Panel** - Build UI for managing clubs and users
3. **Match Management** - Add match details and manual creation

## 📚 Key Documents

- **[README.md](../README.md)** - Complete setup from scratch
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Detailed status and next steps
- **[MULTI_TENANCY_SETUP.md](MULTI_TENANCY_SETUP.md)** - Multi-tenancy guide
- **[Task List](/.gemini/antigravity/brain/0d2b00ac-c21e-4a45-ad80-fa2ffe82fa60/task.md)** - Detailed task checklist

## 🗂️ Project Structure

```
sms-padel-sync/
├── backend/          # Python FastAPI server
│   ├── migrations/   # SQL migration files (numbered)
│   └── *.py         # Backend logic
├── frontend/         # Next.js dashboard
│   └── src/app/     # App routes
├── docs/            # All documentation
└── README.md        # Main setup guide
```

## 🔧 Common Commands

```bash
# Create superuser
python3 backend/setup_superuser.py your-email@example.com

# Seed test data
python3 backend/seed_club.py

# Check database
# Run SQL in Supabase SQL Editor
```

## 💡 Tips

- All migrations are in `backend/migrations/` (run in order)
- Email confirmation is disabled for development
- Superuser badge shows in dashboard header
- Club column only visible to superusers
