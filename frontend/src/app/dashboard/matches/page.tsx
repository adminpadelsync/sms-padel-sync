import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserClub } from '../get-user-club'
import { MatchesClient } from './matches-client'

export default async function MatchesPage() {
    const supabase = await createClient()

    // Get user's club and permissions
    const userClub = await getUserClub()
    if (!userClub) {
        redirect('/not-setup')
    }

    // Fetch ALL Matches (filtering will happen client-side)
    const { data: matches } = await supabase
        .from('matches')
        .select('*, clubs(name)')
        .order('scheduled_time', { ascending: true })

    // Fetch clubs for superusers
    let clubs: { club_id: string; name: string }[] = []
    if (userClub.is_superuser) {
        const { data: clubsData } = await supabase
            .from('clubs')
            .select('club_id, name')
            .eq('active', true)
            .order('name')
        clubs = clubsData || []
    }

    return (
        <MatchesClient
            initialMatches={matches || []}
            isSuperuser={userClub.is_superuser}
            userClubId={userClub.club_id}
            clubs={clubs}
        />
    )
}
