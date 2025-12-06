'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function updatePlayer(playerId: string, data: {
    name: string
    phone_number: string
    declared_skill_level: number
    gender?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('players')
        .update({
            name: data.name,
            phone_number: data.phone_number,
            declared_skill_level: data.declared_skill_level,
            gender: data.gender,
        })
        .eq('player_id', playerId)

    if (error) {
        console.error('Error updating player:', error)
        throw error
    }

    revalidatePath('/dashboard')
}

export async function createPlayer(data: {
    name: string
    phone_number: string
    declared_skill_level: number
    gender?: string
    club_id?: string  // Optional - for superusers to specify club
}) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error('Not authenticated')
    }

    // Get user's club from users table
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('club_id, is_superuser')
        .eq('user_id', user.id)
        .single()

    if (userError || !userData) {
        throw new Error('User not found in system')
    }

    // Determine which club to use
    let club_id = data.club_id || userData.club_id  // Use provided club_id or user's club

    // If superuser and no club specified, require club selection
    if (userData.is_superuser && !club_id) {
        throw new Error('Superusers must select a club')
    }

    if (!club_id) {
        throw new Error('No club associated with user')
    }

    const { error } = await supabase
        .from('players')
        .insert({
            name: data.name,
            phone_number: data.phone_number,
            declared_skill_level: data.declared_skill_level,
            adjusted_skill_level: data.declared_skill_level,
            gender: data.gender,
            club_id: club_id,
            active_status: true,
        })

    if (error) {
        console.error('Error creating player:', error)
        throw error
    }

    revalidatePath('/dashboard')
}

export async function togglePlayerStatus(playerId: string, newStatus: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('players')
        .update({ active_status: newStatus })
        .eq('player_id', playerId)

    if (error) {
        console.error('Error toggling player status:', error)
        throw error
    }

    revalidatePath('/dashboard')
}
