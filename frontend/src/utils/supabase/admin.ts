import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service role key to bypass RLS.
 * This should ONLY be used in Server Actions or API routes.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        console.error('CRITICAL: Missing Supabase Admin Configuration!')
        throw new Error('Missing Supabase Service Role Key')
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}
