import { createClient } from './supabase/client'

export async function authFetch(url: string, options: RequestInit = {}) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
    }

    return fetch(url, { ...options, headers })
}
