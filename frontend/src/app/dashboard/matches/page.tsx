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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Fetch matches for the current club
    const { data: matches } = await supabase
        .from('matches')
        .select(`
            *,
            clubs(name, timezone),
            originator:originator_id(name, phone_number, declared_skill_level)
        `)
        .eq('club_id', userClub.club_id)
        .order('scheduled_time', { ascending: false })

    // Fetched userClub above

    // 2. Fetch all participations for these matches to get correct player lists
    const matchIds = matches?.map(m => m.match_id) || []
    const participationsMap = new Map<string, { team1: Record<string, unknown>[], team2: Record<string, unknown>[], names: string[] }>()

    // Initialize map
    matchIds.forEach(id => participationsMap.set(id, { team1: [], team2: [], names: [] }))

    if (matchIds.length > 0) {
        const { data: participations } = await supabase
            .from('match_participations')
            .select(`
                match_id,
                player_id,
                team_index,
                players (
                    player_id,
                    name,
                    phone_number,
                    declared_skill_level
                )
            `)
            .in('match_id', matchIds)

        participations?.forEach((p: { match_id: string, players: Record<string, unknown> | Record<string, unknown>[], team_index: number }) => {
            const matchData = participationsMap.get(p.match_id)
            if (matchData && p.players) {
                const player = (Array.isArray(p.players) ? p.players[0] : p.players) as { name: string }
                if (!player) return
                matchData.names.push(player.name)
                if (p.team_index === 1) {
                    matchData.team1.push(player)
                } else if (p.team_index === 2) {
                    matchData.team2.push(player)
                }
            }
        })
    }

    // 3. Check for Feedback Requests
    const feedbackRequestMatches = new Set<string>()
    if (matchIds.length > 0) {
        const { data: requests } = await supabase
            .from('feedback_requests')
            .select('match_id')
            .in('match_id', matchIds)
        requests?.forEach(r => feedbackRequestMatches.add(r.match_id))
    }

    // 4. Enrich Matches
    const enrichedMatches = matches?.map(m => {
        const partData = participationsMap.get(m.match_id) || { team1: [], team2: [], names: [] }

        let fStatus = 'N/A'
        if (m.feedback_collected) {
            fStatus = 'Received'
        } else if (feedbackRequestMatches.has(m.match_id)) {
            fStatus = 'Sent'
        }

        return {
            ...m,
            player_names: partData.names,
            team_1_details: partData.team1,
            team_2_details: partData.team2,
            feedback_status: fStatus
        }
    }) || []

    return (
        <MatchesClient
            initialMatches={enrichedMatches}
            userClubId={userClub.club_id}
            userId={user.id}
            userClubTimezone={userClub.club_timezone}
        />
    )
}
