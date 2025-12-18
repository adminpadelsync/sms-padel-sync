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

## AI & NLP (Google Gemini)

### 1. Model Configuration
The specific Gemini model used is configurable via environment variables. This is crucial because model availability varies by region and API version.

- **Variable**: `LLM_MODEL_NAME`
- **Default**: `gemini-2.0-flash`
- **Recommended**: Use `flash` models (e.g., `gemini-1.5-flash` or `gemini-2.0-flash`) for the best balance of speed and cost.

### 2. "Training" & Tuning (Few-Shot Prompting)
The system is "tuned" using few-shot prompting within `backend/logic/reasoner.py`. We don't retrain weights; we provide examples in the prompt instructions.

- **To improve accuracy**:
    1.  Identify a failed intent in the **Scenario Tester**.
    2.  Add a new example to the `PROMPT_TEMPLATE` in `reasoner.py`.
    3.  Example format:
        ```text
        User: "1 9 8"
        Result: { "intent": "SUBMIT_FEEDBACK", "confidence": 0.9, "entities": { "ratings": [1, 9, 8] } }
        ```

### 3. Scenario Tester
The **Conversational Scenario Tester** (`/dashboard/admin/scenarios`) is the primary tool for verifying that prompt changes have the desired effect without affecting live SMS traffic. Always run your "Golden Dataset" of test cases here after modifying the prompt.

### 4. Gemini API Rate Limits (429 Error)
If you encounter `429 Resource exhausted`, it means you've hit the rate limit of the "Free" tier of Google AI Studio. 

#### Immediate Mitigation
-   The Reasoner now includes a **Retry Loop** with exponential backoff. It will automatically wait a few seconds and try again up to 3 times before failing.

#### Permanent Solution (Highly Recommended)
To support a production environment with multiple users, you should upgrade to a **Pay-as-you-go** plan:
1.  Go to [Google AI Studio Settings](https://aistudio.google.com/app/settings/billing).
2.  Enable Billing for your Google Cloud project.
3.  This increases the rate limit from a few requests per minute to significantly higher thresholds suitable for production.
