import { getUserClub } from '../../get-user-club'
import TrainingJigClient from './training-jig-client'

export default async function TrainingJigPage() {
    const userClub = await getUserClub()
    return <TrainingJigClient userClubId={userClub?.club_id || null} />
}
