import { getUserClub } from '../get-user-club'
import { getClubGroups } from './actions'
import { GroupsClient } from './groups-client'
import { redirect } from 'next/navigation'

import { getClubs } from '../get-clubs'

export default async function GroupsPage() {
    const userClub = await getUserClub()
    if (!userClub) {
        redirect('/not-setup')
    }

    let targetClubId = userClub.club_id

    if (userClub.is_superuser && !targetClubId) {
        const clubs = await getClubs()
        if (clubs.length > 0) {
            targetClubId = clubs[0].club_id
        }
    }

    if (!targetClubId) {
        redirect('/not-setup')
    }

    const groups = await getClubGroups(targetClubId)

    return (
        <div className="p-6">
            <GroupsClient initialGroups={groups} clubId={targetClubId} />
        </div>
    )
}
