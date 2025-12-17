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

    // 2. Fetch Players for these matches
    const playerIds = new Set<string>()
    matches?.forEach(m => {
        m.team_1_players?.forEach((id: string) => playerIds.add(id))
        m.team_2_players?.forEach((id: string) => playerIds.add(id))
    })

    let playerMap = new Map<string, string>()
    if (playerIds.size > 0) {
        const { data: players } = await supabase
            .from('players')
            .select('player_id, name')
            .in('player_id', Array.from(playerIds))

        players?.forEach(p => playerMap.set(p.player_id, p.name))
    }

    // 3. Check for Feedback Requests (to determine "Sent" status)
    const matchIds = matches?.map(m => m.match_id) || []
    let feedbackRequestMatches = new Set<string>()

    if (matchIds.length > 0) {
        const { data: requests } = await supabase
            .from('feedback_requests')
            .select('match_id')
            .in('match_id', matchIds)

        requests?.forEach(r => feedbackRequestMatches.add(r.match_id))
    }

    // 4. Enrich Matches
    const enrichedMatches = matches?.map(m => {
        // Get player names
        const names: string[] = []
        m.team_1_players?.forEach((id: string) => {
            if (playerMap.has(id)) names.push(playerMap.get(id)!)
        })
        m.team_2_players?.forEach((id: string) => {
            if (playerMap.has(id)) names.push(playerMap.get(id)!)
        })

        // Determine Feedback Status
        // Logic: 
        // - Received: feedback_collected is true
        // - Sent: feedback_requests exist
        // - N/A: neither (future or not sent yet)
        let fStatus = 'N/A'
        if (m.feedback_collected) {
            fStatus = 'Received'
        } else if (feedbackRequestMatches.has(m.match_id)) {
            fStatus = 'Sent'
        }

        return {
            ...m,
            player_names: names,
            feedback_status: fStatus
        }
    }) || []

    return (
        <MatchesClient
            initialMatches={enrichedMatches}
            isSuperuser={userClub.is_superuser}
            userClubId={userClub.club_id}
            clubs={clubs}
        />
    )
}
