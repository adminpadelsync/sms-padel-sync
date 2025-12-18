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

    // Fetch ALL Players with their group memberships
    const { data: rawPlayers } = await supabase
        .from('players')
        .select(`
            *,
            clubs(name),
            group_memberships(
                player_groups(group_id, name)
            )
        `)
        .order('created_at', { ascending: false })

    // Transform players to flatten the groups structure
    const players = rawPlayers?.map(player => ({
        ...player,
        groups: player.group_memberships
            ?.map((m: any) => m.player_groups)
            .filter((g: any) => g !== null)
            .map((g: any) => ({ group_id: g.group_id, name: g.name })) || []
    })) || []

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
