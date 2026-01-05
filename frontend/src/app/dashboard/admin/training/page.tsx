import { getUserClub } from '../../get-user-club'
import TrainingJigClient from './training-jig-client'
import { createClient } from '@/utils/supabase/server'

export default async function TrainingJigPage() {
    const userClub = await getUserClub()

    let clubs: { club_id: string; name: string }[] = []
    if (userClub?.is_superuser) {
        const supabase = await createClient()
        const { data: clubsData } = await supabase
            .from('clubs')
            .select('club_id, name')
            .eq('active', true)
            .order('name')
        clubs = clubsData || []
    } else if (userClub?.club_id && userClub?.club_name) {
        clubs = [{ club_id: userClub.club_id, name: userClub.club_name }]
    }

    return (
        <TrainingJigClient
            userClubId={userClub?.club_id || null}
            isSuperuser={userClub?.is_superuser || false}
            clubs={clubs}
        />
    )
}
