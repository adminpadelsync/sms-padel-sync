# System Architecture

## Overview
SMS Padel Sync relies on a decoupled architecture:
- **Frontend**: Next.js 14 (App Router) hosted on Vercel.
- **Backend**: FastAPI (Python) hosted on Vercel (serverless functions).
- **Database**: Supabase (PostgreSQL).
- **AI/NLP**: Google Gemini via `google-generativeai`.

## Routing & Deployment

### 1. Vercel Configuration (`vercel.json`)
The `vercel.json` file in the root directory tells Vercel how to route traffic.
- Requests to `/api/*` are rewritten to `api/index.py` (the entry point for FastAPI).
- This ensures that in production, the backend handles all API requests.

### 2. Frontend Proxy (`next.config.ts`) - **CRITICAL**
The Frontend uses Next.js rewrites to proxy API requests to the Backend during development (and sometimes in production depending on the specific Vercel setup).

**IMPORTANT**: Next.js requires an **explicit whitelist** of routes to proxy.
If you add a new endpoint to the Backend (e.g., `/api/new-feature`), you **MUST** also add a rewrite rule in `frontend/next.config.ts`.

#### Example `frontend/next.config.ts`:
```typescript
{
  source: '/api/new-feature/:path*',
  destination:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:8001/api/new-feature/:path*'
      : `${apiUrl || ''}/api/new-feature/:path*`,
}
```

> [!WARNING]
> Failure to add the route to `next.config.ts` will result in a **404 Not Found** error when calling the API from the frontend, even if the backend route exists and is working correctly.

## NLP & Reasoning
The system uses a "Reasoning Gateway" (`backend/logic/reasoner.py`) using Gemini to parse user intents from SMS messages.
- **Fast Path**: Keywords like "PLAY", "RESET" are handled immediately.
- **Slow Path**: Complex inputs are sent to the LLM for intent extraction.

## Dependency Management
- **Root `requirements.txt`**: Used by Vercel for the Python runtime.
- **Backend `requirements.txt`**: Used for local development in `backend/`.
- **Note**: Always keep these in sync. Verify `python-multipart` is present for form data handling.
