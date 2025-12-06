'use server'

import { createClient } from '@/utils/supabase/server'

export interface UserClub {
    club_id: string | null
    club_name: string | null
    is_superuser: boolean
    role: string
}

export async function getUserClub(): Promise<UserClub | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('users')
        .select(`
            club_id,
            is_superuser,
            role,
            clubs (
                name
            )
        `)
        .eq('user_id', user.id)
        .single()

    if (error) {
        console.error('Error fetching user club:', error)
        // User exists in auth but not in users table
        if (error.code === 'PGRST116') {
            console.error('User not found in users table. Email:', user.email)
            console.error('Run: python3 backend/setup_superuser.py', user.email)
        }
        return null
    }

    if (!data) {
        console.error('No user data returned for:', user.email)
        return null
    }

    return {
        club_id: data.club_id,
        club_name: (data.clubs as any)?.name || null,
        is_superuser: data.is_superuser,
        role: data.role
    }
}
