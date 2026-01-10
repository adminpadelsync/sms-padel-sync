import { redirect } from 'next/navigation'
import { getUserClub } from '../get-user-club'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const userClub = await getUserClub()

    // Kick out anyone who isn't a superuser
    if (!userClub?.is_superuser) {
        redirect('/dashboard')
    }

    return <>{children}</>
}
