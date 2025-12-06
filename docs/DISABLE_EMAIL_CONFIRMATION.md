# Disable Email Confirmation in Supabase

For development, you should disable email confirmation:

1. Go to Supabase Dashboard → Authentication → Providers
2. Click on "Email" provider
3. **Disable** "Confirm email"
4. Click Save

This allows users to login immediately after signup without needing to verify their email.

## Alternative: Auto-confirm emails

If you want to keep email confirmation enabled but auto-confirm for development:

1. Go to Authentication → Email Templates
2. Edit the "Confirm signup" template
3. Or use the Supabase CLI to disable it

For production, you'll want email confirmation enabled.
