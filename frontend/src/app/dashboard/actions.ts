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
    avail_weekday_morning?: boolean
    avail_weekday_afternoon?: boolean
    avail_weekday_evening?: boolean
    avail_weekend_morning?: boolean
    avail_weekend_afternoon?: boolean
    avail_weekend_evening?: boolean
    active_status?: boolean
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('players')
        .update({
            name: data.name,
            phone_number: data.phone_number,
            declared_skill_level: data.declared_skill_level,
            gender: data.gender,
            avail_weekday_morning: data.avail_weekday_morning,
            avail_weekday_afternoon: data.avail_weekday_afternoon,
            avail_weekday_evening: data.avail_weekday_evening,
            avail_weekend_morning: data.avail_weekend_morning,
            avail_weekend_afternoon: data.avail_weekend_afternoon,
            avail_weekend_evening: data.avail_weekend_evening,
            active_status: data.active_status,
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
    club_id?: string
    avail_weekday_morning?: boolean
    avail_weekday_afternoon?: boolean
    avail_weekday_evening?: boolean
    avail_weekend_morning?: boolean
    avail_weekend_afternoon?: boolean
    avail_weekend_evening?: boolean
    active_status?: boolean
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
            active_status: data.active_status ?? true, // Default to true if not provided
            avail_weekday_morning: data.avail_weekday_morning ?? false,
            avail_weekday_afternoon: data.avail_weekday_afternoon ?? false,
            avail_weekday_evening: data.avail_weekday_evening ?? false,
            avail_weekend_morning: data.avail_weekend_morning ?? false,
            avail_weekend_afternoon: data.avail_weekend_afternoon ?? false,
            avail_weekend_evening: data.avail_weekend_evening ?? false,
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

export async function deletePlayer(playerId: string) {
    const supabase = await createClient()

    // 1. Delete all match invites for this player
    const { error: invitesError } = await supabase
        .from('match_invites')
        .delete()
        .eq('player_id', playerId)

    if (invitesError) {
        console.error('Error deleting player invites:', invitesError)
        throw invitesError
    }

    // 2. Delete group memberships
    const { error: groupError } = await supabase
        .from('group_memberships')
        .delete()
        .eq('player_id', playerId)

    if (groupError) {
        console.error('Error deleting group memberships:', groupError)
        throw groupError
    }

    // 3. Remove player from any matches (team_1_players, team_2_players)
    // Fetch matches where this player is in either team
    const { data: matchesWithPlayer } = await supabase
        .from('matches')
        .select('match_id, team_1_players, team_2_players')
        .or(`team_1_players.cs.{${playerId}},team_2_players.cs.{${playerId}}`)

    if (matchesWithPlayer && matchesWithPlayer.length > 0) {
        for (const match of matchesWithPlayer) {
            const team1 = (match.team_1_players || []).filter((id: string) => id !== playerId)
            const team2 = (match.team_2_players || []).filter((id: string) => id !== playerId)

            await supabase
                .from('matches')
                .update({ team_1_players: team1, team_2_players: team2 })
                .eq('match_id', match.match_id)
        }
    }

    // 4. Finally, delete the player
    const { error: playerError } = await supabase
        .from('players')
        .delete()
        .eq('player_id', playerId)

    if (playerError) {
        console.error('Error deleting player:', playerError)
        throw playerError
    }

    revalidatePath('/dashboard')
}

export async function verifyPlayer(playerId: string, data: {
    verified: boolean
    level: number
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    const updates: any = {
        pro_verified: data.verified,
        declared_skill_level: data.level,
        adjusted_skill_level: data.level,
    }

    if (data.verified) {
        updates.pro_verified_at = new Date().toISOString()
        updates.pro_verified_by = user.id
        updates.pro_verification_notes = data.notes
    }

    const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('player_id', playerId)

    if (error) {
        console.error('Error verifying player:', error)
        throw error
    }

    revalidatePath('/dashboard')
}
