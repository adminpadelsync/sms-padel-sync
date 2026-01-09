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

    // Fetch authorized clubs for the switcher
    let clubs: { club_id: string; name: string }[] = []
    const supabase = await createClient()

    if (userClub?.is_superuser) {
        // Superusers see all active clubs
        const { data: clubsData } = await supabase
            .from('clubs')
            .select('club_id, name')
            .eq('active', true)
            .order('name')
        clubs = clubsData || []
    } else if (userClub?.user_id) {
        // Regular users see only their assigned clubs
        const { data: userClubsData } = await supabase
            .from('user_clubs')
            .select(`
                club_id,
                clubs (
                    name
                )
            `)
            .eq('user_id', userClub.user_id)

        clubs = (userClubsData || []).map(uc => ({
            //@ts-ignore
            club_id: uc.club_id,
            //@ts-ignore
            name: uc.clubs?.name || 'Unknown Club'
        })).sort((a, b) => a.name.localeCompare(b.name))
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
