'use server'

import { createClient } from '@/utils/supabase/server'

export async function searchPlayers(clubId: string, searchTerm: string = '') {
    const supabase = await createClient()

    let query = supabase
        .from('club_members')
        .select(`
            club_id,
            player:players (
                player_id, 
                name, 
                phone_number, 
                declared_skill_level, 
                adjusted_skill_level, 
                gender,
                active_status
            )
        `)
        .eq('club_id', clubId)
        .eq('players.active_status', true)

    if (searchTerm) {
        // Use ilike for case-insensitive search on the joined player table
        query = query.or(`name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`, { foreignTable: 'players' })
    }

    const { data, error } = await query.limit(20)

    // Flatten result
    const players = data?.map((d: any) => ({
        ...d.player,
        club_id: d.club_id
    })) || []

    if (error) {
        console.error('Error searching players:', error)
        return []
    }

    console.log(`Search for "${searchTerm}" in club ${clubId} returned ${players.length} results`)
    return players
}
