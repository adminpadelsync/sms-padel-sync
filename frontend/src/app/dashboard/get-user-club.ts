'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export interface UserClub {
    club_id: string | null
    club_name: string | null
    club_timezone: string | null
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
                name,
                timezone
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

    let finalClubId = data.club_id
    let finalClubName = (data.clubs as any)?.name

    // If superuser, allow overriding club via cookie
    if (data.is_superuser) {
        const cookieStore = await cookies()
        const operatingClubId = cookieStore.get('operating_club_id')?.value
        if (operatingClubId) {
            finalClubId = operatingClubId
            // Note: We aren't fetching the name for the cookie-overridden club here, 
            // but it shouldn't block main functionality as ID is primary.
            // Client components usually have the list of clubs to look up name.
        }
    }

    return {
        club_id: finalClubId,
        club_name: finalClubName || null,
        club_timezone: (data.clubs as any)?.timezone || null,
        is_superuser: data.is_superuser,
        role: data.role
    }
}
