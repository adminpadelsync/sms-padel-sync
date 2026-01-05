# Local SMS Testing Guide

This guide explains how to test real SMS flows on your local machine using **ngrok** and a dedicated test club.

## Prerequisites
- [ngrok](https://ngrok.com/) installed (`brew install ngrok/ngrok/ngrok`)
- Twilio account with a dedicated local test number

## 1. ngrok Configuration

The project uses the following ngrok configuration (saved for reference):
- **Auth Token**: `37qPbr3Z0zr9FJJ4BpWbDGcGV0t_85YXPp3ryewPrVLdGri1i`
- **Forwarding URL**: `https://geraldo-productile-unguiltily.ngrok-free.dev`

To start the tunnel:
```bash
# Set auth token (first time only)
ngrok config add-authtoken 37qPbr3Z0zr9FJJ4BpWbDGcGV0t_85YXPp3ryewPrVLdGri1i

# Start tunnel to local FastAPI server
ngrok http 8000
```

## 2. Twilio Webhook Setup

1. Go to your **Twilio Console** → **Phone Numbers** → **Manage** → **Active Numbers**.
2. Select the local test number: **`+15614892694`** (Adams Local Padel).
3. Scroll to **Messaging**.
4. Set "A MESSAGE COMES IN" to **Webhook**.
5. URL: `https://geraldo-productile-unguiltily.ngrok-free.dev/api/webhook/sms`
6. Method: **HTTP POST**.
7. Save configuration.

## 3. Dedicated Test Club

The system includes a dedicated club for local testing to avoid mixing data with production:
- **Club Name**: `Adams Local Padel`
- **Phone Number**: `+15614892694`

Any SMS sent to this number will be routed to your local machine (if ngrok and your backend are running).

## 4. Local Development Workflow

1. **Start Backend**: `cd backend && uvicorn main:app --reload`
2. **Start ngrok**: `ngrok http 8000`
3. **Send SMS**: Text "PLAY" or any command to `+15614892694`.
4. **Debug**: View local logs in the terminal where `uvicorn` is running.
