'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export interface UserClub {
    user_id: string
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

    // 1. Get global role and superuser status
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_superuser, role, club_id')
        .eq('user_id', user.id)
        .single()

    if (userError || !userData) {
        console.error('Error fetching user base data:', userError)
        return null
    }

    // 2. Get assigned clubs from user_clubs
    const { data: userClubsData } = await supabase
        .from('user_clubs')
        .select(`
            club_id,
            role,
            clubs (
                name,
                timezone
            )
        `)
        .eq('user_id', user.id)

    let finalClubId = userData.club_id
    let finalClubName = null
    let finalClubTimezone = null

    // If we have data in user_clubs, use the first one (or later, the prioritized one)
    if (userClubsData && userClubsData.length > 0) {
        const firstClub = userClubsData[0]
        finalClubId = firstClub.club_id
        finalClubName = (firstClub.clubs as any)?.name
        finalClubTimezone = (firstClub.clubs as any)?.timezone
    } else if (userData.club_id) {
        // Fallback to legacy column during transition
        const { data: legacyClub } = await supabase
            .from('clubs')
            .select('name, timezone')
            .eq('club_id', userData.club_id)
            .single()

        if (legacyClub) {
            finalClubName = legacyClub.name
            finalClubTimezone = legacyClub.timezone
        }
    }

    // 3. Allow overriding club via cookie (for superusers or managers with multiple clubs)
    const cookieStore = await cookies()
    const operatingClubId = cookieStore.get('operating_club_id')?.value

    if (operatingClubId) {
        let canAccess = userData.is_superuser

        // If not superuser, check if assigned to this club
        if (!canAccess) {
            canAccess = userClubsData?.some(uc => uc.club_id === operatingClubId) || false
        }

        if (canAccess) {
            const { data: overriddenClub } = await supabase
                .from('clubs')
                .select('name, timezone')
                .eq('club_id', operatingClubId)
                .single()

            if (overriddenClub) {
                return {
                    user_id: user.id,
                    club_id: operatingClubId,
                    club_name: overriddenClub.name,
                    club_timezone: overriddenClub.timezone || null,
                    is_superuser: userData.is_superuser,
                    role: userData.role
                }
            }
        }
    }

    return {
        user_id: user.id,
        club_id: finalClubId,
        club_name: finalClubName,
        club_timezone: finalClubTimezone || null,
        is_superuser: userData.is_superuser,
        role: userData.role
    }
}
