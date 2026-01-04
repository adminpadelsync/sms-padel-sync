import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Fetch all players (including inactive for testing purposes)
        const { data: players, error } = await supabase
            .from('players')
            .select('player_id, name, phone_number, declared_skill_level, gender')
            .order('name')

        if (error) {
            console.error('Error fetching players:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ players: players || [] })
    } catch (error) {
        console.error('Error in players API:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
