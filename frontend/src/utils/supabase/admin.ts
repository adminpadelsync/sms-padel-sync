import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
    // Check for TESTING flag to determine which environment keys to use
    const isTesting = process.env.TESTING === 'true' || process.env.NEXT_PUBLIC_TESTING === 'true'

    const url = isTesting
        ? (process.env.SUPABASE_URL_TEST || process.env.NEXT_PUBLIC_SUPABASE_URL_TEST || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
        : (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)

    const key = isTesting
        ? (process.env.SUPABASE_SERVICE_ROLE_KEY_TEST || process.env.SUPABASE_SERVICE_ROLE_KEY)
        : process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        console.error(`CRITICAL: Missing Supabase Admin Configuration! (Mode: ${isTesting ? 'TEST' : 'PROD'})`)
        throw new Error('Missing Supabase Service Role Key')
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}
