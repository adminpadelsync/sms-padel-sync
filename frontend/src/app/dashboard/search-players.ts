'use server'

import { createClient } from '@/utils/supabase/server'

export async function searchPlayers(clubId: string, searchTerm: string = '') {
    const supabase = await createClient()

    let query = supabase
        .from('players')
        .select('player_id, name, phone_number, declared_skill_level, gender')
        .eq('club_id', clubId)
        .eq('active_status', true)

    if (searchTerm) {
        // Use ilike for case-insensitive search
        query = query.or(`name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
    }

    const { data, error } = await query.order('name').limit(20)

    if (error) {
        console.error('Error searching players:', error)
        return []
    }

    console.log(`Search for "${searchTerm}" in club ${clubId} returned ${data?.length || 0} results`)
    return data || []
}
