import { redirect } from 'next/navigation'
import { getUserClub } from '../../get-user-club'

export default async function NewClubLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const userClub = await getUserClub()

    // Creating clubs is a superuser-only action
    if (!userClub?.is_superuser) {
        redirect('/dashboard')
    }

    return <>{children}</>
}
