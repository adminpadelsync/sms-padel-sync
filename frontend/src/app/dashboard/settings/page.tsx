import { getUserClub } from '../get-user-club'
import SettingsClient from './settings-client'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
    const userClub = await getUserClub()

    if (!userClub) {
        redirect('/not-setup')
    }

    return (
        <SettingsClient userClubId={userClub.club_id} />
    )
}
