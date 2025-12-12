'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export interface CreateClubData {
    name: string
    address?: string
    poc_name?: string
    poc_phone?: string
    main_phone?: string
    booking_system?: string
    twilio_phone_number: string
    court_count: number
}

export async function createClub(data: CreateClubData) {
    const supabase = await createClient()

    // Get current user and verify superuser status
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: userData } = await supabase
        .from('users')
        .select('is_superuser')
        .eq('user_id', user.id)
        .single()

    if (!userData?.is_superuser) {
        throw new Error('Unauthorized: Superuser access required')
    }

    try {
        // Actually, for simplicity and robustness (avoiding HTTP hops), let's implement the logic directly here using Supabase.
        // It matches the pattern of other actions.ts.

        // 1. Insert Club
        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .insert({
                name: data.name,
                phone_number: data.twilio_phone_number,
                court_count: data.court_count,
                address: data.address,
                poc_name: data.poc_name,
                poc_phone: data.poc_phone,
                main_phone: data.main_phone,
                booking_system: data.booking_system,
                active: true,
                settings: {}
            })
            .select()
            .single()

        if (clubError) throw new Error(`Failed to create club: ${clubError.message}`)

        // 2. Create Courts
        const courts = Array.from({ length: data.court_count }, (_, i) => ({
            club_id: club.club_id,
            name: `Court ${i + 1}`,
            settings: {}
        }))

        const { error: courtsError } = await supabase
            .from('courts')
            .insert(courts)

        if (courtsError) throw new Error(`Failed to create courts: ${courtsError.message}`)

        revalidatePath('/dashboard')
        return { success: true, clubId: club.club_id }

    } catch (error) {
        console.error('Create Club Error:', error)
        throw error
    }
}
