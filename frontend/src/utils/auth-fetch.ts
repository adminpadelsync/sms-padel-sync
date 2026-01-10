import { createClient } from './supabase/client'

export async function authFetch(url: string, options: RequestInit = {}) {
    const supabase = createClient()

    // Use getSession for speed, but log if it's missing
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
        console.error(`[authFetch] Session error for ${url}:`, sessionError)
    }

    if (!session) {
        console.warn(`[authFetch] NO SESSION found for ${url}. Auth header will be missing.`)
    } else {
        const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : 'unknown'
        console.log(`[authFetch] Session active for ${url}. Token expires at: ${expiresAt}`)
    }

    const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...((options.headers || {}) as Record<string, string>),
        ...(session?.access_token ? {
            'Authorization': `Bearer ${session.access_token}`,
            'X-Padel-Token': session.access_token
        } : {})
    }

    return fetch(url, { ...options, headers })
}
