import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserClub } from './get-user-club'
import { DashboardClient } from './dashboard-client'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    active_status: boolean
    club_id: string
    clubs?: {
        name: string
    }
}

interface Match {
    match_id: string
    scheduled_time: string
    status: string
    team_1_players: string[]
    team_2_players: string[]
    club_id: string
    clubs?: {
        name: string
    }
}

export default async function Dashboard() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get user's club and permissions
    const userClub = await getUserClub()
    if (!userClub) {
        redirect('/not-setup')
    }

    // Fetch ALL Players (filtering will happen client-side)
    const { data: players } = await supabase
        .from('players')
        .select('*, clubs(name)')
        .order('created_at', { ascending: false })

    // Fetch ALL Matches (filtering will happen client-side)
    const { data: matches } = await supabase
        .from('matches')
        .select('*, clubs(name)')
        .order('created_at', { ascending: false })

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
        <DashboardClient
            initialPlayers={players || []}
            initialMatches={matches || []}
            userEmail={user?.email || ''}
            isSuperuser={userClub.is_superuser}
            userClubId={userClub.club_id}
            clubs={clubs}
        />
    )
}
