import { cookies } from 'next/headers'
import { getUserClub } from './get-user-club'
import { createClient } from '@/utils/supabase/server'
import { SidebarClient } from './sidebar-client'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const userClub = await getUserClub()
    const cookieStore = await cookies()
    const isCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true'

    // Fetch all active clubs if superuser for the switcher
    let clubs: { club_id: string; name: string }[] = []
    if (userClub?.is_superuser) {
        const supabase = await createClient()
        const { data: clubsData } = await supabase
            .from('clubs')
            .select('club_id, name')
            .eq('active', true)
            .order('name')
        clubs = clubsData || []
    }

    return (
        <SidebarClient
            userClub={{
                club_id: userClub?.club_id || null,
                club_name: userClub?.club_name || null,
                is_superuser: userClub?.is_superuser || false
            }}
            clubs={clubs}
            initialCollapsed={isCollapsed}
        >
            {children}
        </SidebarClient>
    )
}
