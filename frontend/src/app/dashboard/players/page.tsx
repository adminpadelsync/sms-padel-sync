import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserClub } from '../get-user-club'
import { PlayersClient } from './players-client'

export default async function PlayersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

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
                    player_groups(group_id, name)
                )
            )
        `)
        .order('added_at', { ascending: false })

    // Transform and flatten the structure
    const players = members?.map((m: any) => {
        const player = m.players
        return {
            ...player,
            club_id: m.club_id, // Ensure club_id is present for the client-side filter
            groups: player.group_memberships
                ?.map((gm: any) => gm.player_groups)
                .filter((g: any) => g !== null)
                .map((g: any) => ({ group_id: g.group_id, name: g.name })) || []
        }
    }) || []

    // Fetch clubs for the switcher
    const { data: clubs } = await supabase
        .from('clubs')
        .select('club_id, name')
        .order('name')

    return (
        <PlayersClient
            initialPlayers={players}
            isSuperuser={userClub.is_superuser}
            userClubId={userClub.club_id}
            clubs={clubs || []}
        />
    )
}
