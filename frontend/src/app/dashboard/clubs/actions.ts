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
    twilio_phone_number?: string // Now optional
    selected_provision_number?: string // New field
    court_count: number
    timezone?: string
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
                phone_number: data.twilio_phone_number || data.selected_provision_number,
                court_count: data.court_count,
                address: data.address,
                poc_name: data.poc_name,
                poc_phone: data.poc_phone,
                main_phone: data.main_phone,
                booking_system: data.booking_system,
                timezone: data.timezone || 'America/New_York',
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

        // 3. Provision Twilio Number if selected
        if (data.selected_provision_number) {
            try {
                // Call the backend API we just created
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
                const provisionRes = await fetch(`${baseUrl}/api/clubs/${club.club_id}/provision-number`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone_number: data.selected_provision_number })
                })

                if (!provisionRes.ok) {
                    console.error('Failed to provision number after club creation')
                }
            } catch (provErr) {
                console.error('Error provisioning number:', provErr)
            }
        }

        return { success: true, clubId: club.club_id }

    } catch (error) {
        console.error('Create Club Error:', error)
        throw error
    }
}

export async function getAvailableNumbers(areaCode: string) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
    const res = await fetch(`${baseUrl}/api/clubs/available-numbers?area_code=${areaCode}`)
    if (!res.ok) throw new Error('Failed to fetch available numbers')
    return res.json()
}

export async function provisionClubNumber(clubId: string, phoneNumber: string) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
    const res = await fetch(`${baseUrl}/api/clubs/${clubId}/provision-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber })
    })
    if (!res.ok) throw new Error('Failed to provision number')
    return res.json()
}

export async function releaseClubNumber(clubId: string) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
    const res = await fetch(`${baseUrl}/api/clubs/${clubId}/release-number`, {
        method: 'DELETE'
    })
    if (!res.ok) throw new Error('Failed to release number')
    return res.json()
}
