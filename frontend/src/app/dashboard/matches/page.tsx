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

    // Fetch ALL Matches (filtering will happen client-side)
    const { data: matches } = await supabase
        .from('matches')
        .select(`
            *,
            clubs(name, timezone),
            originator:originator_id(name, phone_number, declared_skill_level)
        `)
        .order('scheduled_time', { ascending: false })

    // Fetch clubs for superusers
    let clubs: { club_id: string; name: string }[] = []
    if (userClub.is_superuser) {
        const { data: clubsData } = await supabase
            .from('clubs')
            .select('club_id, name, timezone')
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

    const playerMap = new Map<string, any>()
    if (playerIds.size > 0) {
        const { data: players } = await supabase
            .from('players')
            .select('player_id, name, phone_number, declared_skill_level')
            .in('player_id', Array.from(playerIds))

        players?.forEach(p => playerMap.set(p.player_id, p))
    }

    // 3. Check for Feedback Requests (to determine "Sent" status)
    const matchIds = matches?.map(m => m.match_id) || []
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
        // Get player details
        const details1: any[] = []
        const details2: any[] = []
        const names: string[] = []

        m.team_1_players?.forEach((id: string) => {
            if (playerMap.has(id)) {
                const p = playerMap.get(id)
                details1.push(p)
                names.push(p.name)
            }
        })
        m.team_2_players?.forEach((id: string) => {
            if (playerMap.has(id)) {
                const p = playerMap.get(id)
                details2.push(p)
                names.push(p.name)
            }
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
            team_1_details: details1,
            team_2_details: details2,
            feedback_status: fStatus
        }
    }) || []

    return (
        <MatchesClient
            initialMatches={enrichedMatches}
            isSuperuser={userClub.is_superuser}
            userClubId={userClub.club_id}
            clubs={clubs}
            userId={user.id}
            userClubTimezone={userClub.club_timezone}
        />
    )
}
