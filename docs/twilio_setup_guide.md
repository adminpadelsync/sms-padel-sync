# Complete Twilio Setup Guide for Padel Sync

This guide walks you through setting up Twilio from scratch to work with our Padel Sync application.

## Phase 1: Account Creation & Number

1.  **Sign Up**: Go to [twilio.com](https://www.twilio.com) and create a free account.
2.  **Verify Email/Phone**: Follow the prompts to verify your email and personal phone number.
3.  **Get a Number**:
    *   In the Twilio Console, click **"Get a trial number"** (or "Get your first Twilio number").
    *   **Important**: If possible, try to get a **Toll-Free Number** (starts with 8xx) as the verification process is often simpler than local numbers (10DLC).

## Phase 2: Regulatory Verification (The Hard Part)

Twilio now requires verification for *all* messaging to prevent spam. You cannot send messages to anyone except your own verified personal number until this is done.

### Option A: Stay in "Trial Mode" (For Development Only)
*   **Pros**: No verification forms, instant setup.
*   **Cons**: You can ONLY text your own verified personal phone number. You cannot text other people.
*   **How to use**:
    1.  Go to **Phone Numbers** > **Manage** > **Verified Caller IDs**.
    2.  Add your personal cell phone.
    3.  You are done! You can now test the app using your personal phone.

### Option B: Full Verification (For Production/Real Users)
If you need to text other people, you must complete the **Toll-Free Verification**.

1.  Go to **Phone Numbers** > **Manage** > **Active Numbers**.
2.  Click your Toll-Free number.
3.  You will see a banner saying "Verification Required". Click **Start Verification**.
4.  **Step 1: Business Info**: Fill in your real name/address.
5.  **Step 2: Use Case**:
    *   **Estimated Volume**: 1,000
    *   **Use Case Category**: Customer Care
    *   **Opt-in Type**: Via Text
    *   **Use Case Description**:
        > We provide a padel court matchmaking service for club members. Users text our number to find doubles matches with other players at their skill level. The system coordinates availability, finds compatible players, and confirms court bookings via 2-way SMS.
    *   **Sample Message**:
        > Match confirmed! Tomorrow 6pm, Court 3. Teams: Adam+John vs Mike+Steve. Reply YES to confirm.
    *   **Opt-in Confirmation Message**:
        > Welcome to Padel Sync! Let's get you set up. First, what is your full name? Msg & Data rates may apply. Reply STOP to opt out.
    *   **Proof of Consent (URL)**:
        *   Download the flyer image we generated.
        *   Upload it to a public site (e.g., Imgur, Google Drive link).
        *   Paste that URL here.

## Phase 3: Connecting the App (Webhooks)

This tells Twilio where to send the SMS when someone texts your number.

1.  **Start your Backend**:
    ```bash
    cd backend
    source venv/bin/activate
    uvicorn main:app --reload --port 8001
    ```

2.  **Start ngrok** (in a new terminal):
    ```bash
    ngrok http 8001
    ```
    *   Copy the URL that looks like `https://xxxx.ngrok-free.app`.

3.  **Configure Twilio**:
    *   Go to **Phone Numbers** > **Manage** > **Active Numbers**.
    *   Click your number.
    *   Scroll to **Messaging** -> **A Message Comes In**.
    *   Select **Webhook**.
    *   URL: `YOUR_NGROK_URL/webhook/sms` (e.g., `https://xxxx.ngrok-free.app/webhook/sms`).
    *   Method: **POST**.
    *   Click **Save**.

## Phase 4: Credentials

1.  Go to the [Twilio Console Dashboard](https://console.twilio.com/).
2.  Copy your **Account SID** and **Auth Token**.
3.  Paste them into your `backend/.env` file:
    ```env
    TWILIO_ACCOUNT_SID=AC...
    TWILIO_AUTH_TOKEN=...
    TWILIO_PHONE_NUMBER=+18885550123
    ```

## Phase 5: Test It

1.  Text "Hi" to your Twilio number from your personal cell phone.
2.  You should get a reply asking for your name!
