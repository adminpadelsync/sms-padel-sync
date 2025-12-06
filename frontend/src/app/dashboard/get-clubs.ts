'use server'

import { createClient } from '@/utils/supabase/server'

export async function getClubs() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('clubs')
        .select('club_id, name')
        .eq('active', true)
        .order('name')

    if (error) {
        console.error('Error fetching clubs:', error)
        return []
    }

    return data || []
}
