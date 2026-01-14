import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserClub } from '../get-user-club'
import { PlayersClient } from './players-client'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
    active_status: boolean
    club_id: string
    gender?: string
}

export default async function PlayersPage() {
    const supabase = await createClient()
    await supabase.auth.getUser()

    // Get user's club and permissions
    const userClub = await getUserClub()
    if (!userClub) {
        redirect('/not-setup')
    }

    // Fetch ALL Players via club_members to ensure they have a club_id
    // and correctly handle the join
    const { data: members } = await supabase
        .from('club_members')
        .select(`
            club_id,
            players (
                *,
                clubs(name),
                group_memberships(
                    player_groups(group_id, name, club_id)
                )
            )
        `)
        .order('added_at', { ascending: false })

    // Transform and flatten the structure
    const players = members?.map((m: { club_id: string, players: Record<string, unknown> | Record<string, unknown>[] }) => {
        const player = (Array.isArray(m.players) ? m.players[0] : m.players) as Record<string, unknown> | undefined;
        if (!player) return null;

        return {
            ...player,
            club_id: m.club_id, // Ensure club_id is present for the client-side filter
            groups: (player.group_memberships as Record<string, unknown>[] || [])
                .map((gm) => Array.isArray(gm.player_groups) ? gm.player_groups[0] : gm.player_groups)
                .filter((g) => g !== null && g.club_id === m.club_id) // Filter by club_id
                .map((g: { group_id: string; name: string }) => ({
                    group_id: g.group_id,
                    name: g.name
                }))
        }
    }).filter((p): p is NonNullable<typeof p> => !!p) || []

    // Clubs query removed as it was unused

    return (
        <PlayersClient
            initialPlayers={players as unknown as Player[]}
            userClubId={userClub.club_id}
            userClubTimezone={userClub.club_timezone}
        />
    )
}
