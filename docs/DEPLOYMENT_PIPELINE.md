# Padel Sync Development & Deployment Pipeline

This guide outlines the complete flow for developing, testing, and deploying features on the Padel Sync platform.

## Pipeline Overview

| Stage | Environment | Trigger | Webhook Target | Compliance |
| :--- | :--- | :--- | :--- | :--- |
| **1. Local** | Localhost | Manual | ngrok URL | Mock/Simulator or Sandbox |
| **2. Preview** | Vercel Preview | Git Push (any branch) | `*-git-preview-*.vercel.app` | A2P Registered (Service: Customer Care) |
| **3. Production** | Vercel Prod | Merge to `main` | `padelsync.com` | A2P Registered (Service: Customer Care) |

---

## 1. Local Development
For rapid Iteration without real SMS costs.

- **Option A: Simulator (Default)**: Messages are written to the `sms_outbox` table in Supabase. Use the **Admin Dashboard > SMS Simulator** to view and reply.
- **Option B: Real SMS (ngrok)**:
    1. Start Backend: `uvicorn main:app --reload`
    2. Start ngrok: `ngrok http 8000`
    3. Update Twilio Number: Point "A Message Comes In" to your ngrok URL.
    4. **Warning**: Remember to point it back when done!

---

## 2. Preview Environment (Vercel)
Used for testing real SMS flows and compliance before going live.

### Setup (One-time)
1. **Twilio Integration Setting**: 
   - Go to `Messaging > Services > Customer Care A2P Messaging Service > Integration`.
   - Set to **"Defer to sender's webhook"**. This allows multiple environments to share one service.
2. **Vercel Protection Bypass**: 
   - In Vercel Backend Project settings, go to `Deployment Protection`.
   - **Disable "Vercel Authentication"** for the **Preview** environment. (Necessary so Twilio can reach your webhook).

### Branch Workflow
1. Push your code to a branch (e.g., `preview`).
2. Vercel generates unique URLs for Frontend and Backend.
3. **Align Environment Variables** in the Vercel Dashboard:
    - **Frontend Preview**: `NEXT_PUBLIC_API_URL` -> Your **Backend Preview** URL.
    - **Backend Preview**: `API_BASE_URL` -> Your **Frontend Preview** URL.
    - **Backend Preview**: `TWILIO_WEBHOOK_URL` -> Your **Backend Preview** URL + `/api/webhook/sms`.
    - **Backend Preview**: `TWILIO_MESSAGING_SERVICE_SID` -> `MG316cc77e9ef996c55d81a96c7cb0d06d`.
4. **Supabase Whitelisting**:
    - Go to Supabase Dashboard (Test Project) > Authentication > URL Configuration.
    - Add your **Frontend Preview URL** to the **Redirect URIs** (e.g., `https://*-preview-*.vercel.app/**`).
5. **Provision**: Click "Provision Number" in your Preview Dashboard.
    - Purchase a number.
    - Register it for A2P compliance.
    - Point it to your specific Preview backend URL.
6. **Service Role Key**: Go to **Settings > Environment Variables**.
    - Add `SUPABASE_SERVICE_ROLE_KEY` with the **Test** project secret.
    - Select **Preview** and **Development** environment scopes.

---

## 3. Production Deployment
The live system on `main`.

1. **Merge**: Merge your changes into `main`.
2. **Verify Env Vars**:
    - `TWILIO_WEBHOOK_URL`: `https://padelsync.com/api/webhook/sms`
    - `TWILIO_MESSAGING_SERVICE_SID`: `MG316cc77e9ef996c55d81a96c7cb0d06d`
    - `NEXT_PUBLIC_API_URL`: `https://padelsync.com`
3. **Security**: Vercel Authentication can remain **Enabled** for Production because custom domains (like padelsync.com) are automatically excluded from protection.
4. **Service Role Key**: Go to **Settings > Environment Variables**.
    - Add `SUPABASE_SERVICE_ROLE_KEY` with the **Production** project secret. 
    - Ensure it is only available in the **Production** environment scope.

---

## Source of Truth: Environment Variable Mapping

| Project | Environment | Variable | Value |
| :--- | :--- | :--- | :--- |
| **Backend** | Preview | `TWILIO_WEBHOOK_URL` | `https://backend-git-preview-*.vercel.app/api/webhook/sms` |
| **Backend** | All | `TWILIO_MESSAGING_SERVICE_SID` | `MG316cc77e9ef996c55d81a96c7cb0d06d` |
| **Frontend** | Preview | `NEXT_PUBLIC_API_URL` | `https://backend-git-preview-*.vercel.app` |
| **Frontend** | All | `SUPABASE_SERVICE_ROLE_KEY` | (Supabase Service Role Secret) |

> [!CAUTION]
> **Leading Tabs/Spaces**: Always ensure your environment variables (especially SIDs) do not have accidental spaces or tab characters at the beginning. The backend now performs automatic cleaning, but best practice is to keep the dashboard clean.
