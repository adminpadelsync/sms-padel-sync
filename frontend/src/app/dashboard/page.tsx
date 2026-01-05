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
        timezone: string
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

    // Fetch Players via club_members to ensure they have a club_id
    let memberQuery = supabase
        .from('club_members')
        .select(`
            club_id,
            players (
                *,
                clubs(name),
                group_memberships(
                    player_groups(group_id, name)
                )
            )
        `)
        .order('added_at', { ascending: false })

    // Fetch Matches with server-side filtering
    let matchQuery = supabase
        .from('matches')
        .select('*, clubs(name, timezone)')
        .order('created_at', { ascending: false })

    // Optimization: Filter by club for non-superusers
    if (!userClub.is_superuser) {
        memberQuery = memberQuery.eq('club_id', userClub.club_id)
        matchQuery = matchQuery.eq('club_id', userClub.club_id)
    }

    const { data: members } = await memberQuery

    // Transform and flatten
    const players = members?.map((m: any) => {
        const player = m.players
        return {
            ...player,
            club_id: m.club_id,
            groups: player.group_memberships
                ?.map((gm: any) => gm.player_groups)
                .filter((g: any) => g !== null)
                .map((g: any) => ({ group_id: g.group_id, name: g.name })) || []
        }
    }) || []

    const { data: matches } = await matchQuery

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
            userClubId={userClub.club_id}
            userClubTimezone={userClub.club_timezone}
        />
    )
}
