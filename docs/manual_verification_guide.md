# Manual Verification Setup Guide

There are two primary ways to verify the SMS flow: the **Simulator** (for rapid logic testing) and **Real Hardware** (for end-to-end Twilio verification).

## 🔗 Method 1: SMS Testing Simulator (Recommended)
The **Admin Simulator** (`/dashboard/admin/simulator`) is the fastest way to test conversational logic without spending Twilio credits or configuring webhooks.

- **Unified Inbox/Outbox**: Simulates real player phone numbers.
- **Backend Connected**: Displays a green indicator when the frontend -> backend proxy is active.
- **Safety**: Automatically enables `force_test_mode` for its requests, ensuring responses are trapped in the simulator outbox and not sent to real phones.

---

## 📱 Method 2: Testing with Real Hardware (Twilio)
To test the SMS flow with your real phone, you need to expose your local server to the internet so Twilio can reach it.

## 1. Start the Backend Server
Open a terminal in the `backend` directory and run:
```bash
cd backend
# Activate venv if you haven't already
source venv/bin/activate
# Run the server
uvicorn main:app --reload --port 8001
```

## 2. Expose Localhost via ngrok
Open a **new terminal window** and run:
```bash
# If you don't have ngrok installed:
brew install ngrok/ngrok/ngrok

# Start ngrok forwarding to port 8001
ngrok http 8001
```
Copy the **Forwarding URL** (it looks like `https://xxxx-xx-xx.ngrok-free.app`).

## 3. Configure Twilio Webhook
1. Log in to your [Twilio Console](https://console.twilio.com/).
2. Go to **Phone Numbers** > **Manage** > **Active Numbers**.
3. Click on your phone number.
4. Scroll down to the **Messaging** section.
5. Under **A Message Comes In**, select **Webhook**.
6. Paste your ngrok URL and append `/webhook/sms`.
   - Example: `https://xxxx-xx-xx.ngrok-free.app/webhook/sms`
7. Ensure the method is set to **POST**.
8. Click **Save**.

## 4. Test It!
Text "Hi" to your Twilio number. You should receive a response from your local backend!
