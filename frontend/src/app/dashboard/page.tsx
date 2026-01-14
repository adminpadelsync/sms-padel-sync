import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserClub } from './get-user-club'
import { DashboardClient } from './dashboard-client'

interface Player {
    player_id: string
    active_status: boolean
    club_id: string
}

interface Match {
    match_id: string
    scheduled_time: string
    status: string
    club_id: string
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
    const players = members?.map((m: { club_id: string, players: Record<string, unknown> | Record<string, unknown>[] }) => {
        const player = (Array.isArray(m.players) ? m.players[0] : m.players) as Record<string, unknown> | undefined;
        if (!player) return null;

        return {
            ...player,
            club_id: m.club_id,
            groups: (player.group_memberships as Record<string, unknown>[] || [])
                .map((gm) => Array.isArray(gm.player_groups) ? gm.player_groups[0] : gm.player_groups)
                .filter(Boolean)
                .map((g: { group_id: string; name: string }) => ({
                    group_id: g.group_id,
                    name: g.name
                }))
        }
    }).filter((p): p is NonNullable<typeof p> => !!p) || []

    const { data: matches } = await matchQuery

    // Fetch clubs for superusers
    if (userClub.is_superuser) {
        await supabase
            .from('clubs')
            .select('club_id, name')
            .eq('active', true)
            .order('name')
    }

    return (
        <DashboardClient
            initialPlayers={players as unknown as Player[]}
            initialMatches={matches as unknown as Match[] || []}
            userEmail={user?.email || ''}
            userClubId={userClub.club_id}
            userClubTimezone={userClub.club_timezone}
        />
    )
}
