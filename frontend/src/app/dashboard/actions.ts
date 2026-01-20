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

    // Record Rating History if successful
    if (!error) {
        await supabase.from('player_rating_history').insert({
            player_id: playerId,
            new_elo_rating: (data.declared_skill_level * 400) + 500,
            new_sync_rating: data.declared_skill_level,
            change_type: 'manual_adjustment',
            notes: 'Manual profile update'
        })
    }

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
    const club_id = data.club_id || userData.club_id  // Use provided club_id or user's club

    // If superuser and no club specified, require club selection
    if (userData.is_superuser && !club_id) {
        throw new Error('Superusers must select a club')
    }

    if (!club_id) {
        throw new Error('No club associated with user')
    }

    // Use admin client for players table operations because players are universal
    // and a club admin might not have RLS permission to see a player who exists 
    // but isn't yet in their club.
    const { createAdminClient } = await import('@/utils/supabase/admin')
    const adminSupabase = createAdminClient()

    // Check if player already exists by phone number (using admin to bypass RLS)
    const { data: existingPlayer } = await adminSupabase
        .from('players')
        .select('player_id')
        .eq('phone_number', data.phone_number)
        .maybeSingle()

    let playerId: string

    if (existingPlayer) {
        playerId = existingPlayer.player_id
        console.log('Found existing player by phone number (via admin):', playerId)
    } else {
        // Create new player if they don't exist
        playerId = crypto.randomUUID()
        console.log('Creating new universal player with ID (via admin):', playerId)

        const { error: createError } = await adminSupabase
            .from('players')
            .insert({
                player_id: playerId,
                name: data.name,
                phone_number: data.phone_number,
                declared_skill_level: data.declared_skill_level,
                adjusted_skill_level: data.declared_skill_level,
                gender: data.gender,
                active_status: data.active_status ?? true,
                avail_weekday_morning: data.avail_weekday_morning ?? false,
                avail_weekday_afternoon: data.avail_weekday_afternoon ?? false,
                avail_weekday_evening: data.avail_weekday_evening ?? false,
                avail_weekend_morning: data.avail_weekend_morning ?? false,
                avail_weekend_afternoon: data.avail_weekend_afternoon ?? false,
                avail_weekend_evening: data.avail_weekend_evening ?? false,
            })

        if (createError) {
            console.error('Error creating player via admin:', createError)
            throw createError
        }
    }

    // 2. Add to club_members
    const { error: memberError } = await supabase
        .from('club_members')
        .upsert({
            player_id: playerId,
            club_id: club_id,
        })

    if (memberError) {
        console.error('Error adding player to club:', memberError)
        throw memberError
    }

    // 3. Record Rating History (only if new or if level changed significantly)
    // For simplicity, always record if it's a manual creation
    await supabase.from('player_rating_history').insert({
        player_id: playerId,
        new_elo_rating: (data.declared_skill_level * 400) + 500,
        new_sync_rating: data.declared_skill_level,
        change_type: existingPlayer ? 'manual_adjustment' : 'onboarding',
        notes: existingPlayer ? 'Added to club via dashboard' : 'Manually created via dashboard'
    })

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

export async function removePlayerFromClub(playerId: string, clubId: string) {
    const supabase = await createClient()

    if (!clubId) {
        throw new Error('clubId is required to remove player from club')
    }

    console.log(`Removing player ${playerId} from club ${clubId}`)

    // 1. Delete all match invites for this player within this club's matches
    const { data: clubMatches } = await supabase
        .from('matches')
        .select('match_id')
        .eq('club_id', clubId)

    const matchIds = clubMatches?.map(m => m.match_id) || []

    if (matchIds.length > 0) {
        const { error: invitesError } = await supabase
            .from('match_invites')
            .delete()
            .eq('player_id', playerId)
            .in('match_id', matchIds)

        if (invitesError) {
            console.error('Error deleting player invites for club:', invitesError)
            throw invitesError
        }
    }

    // 2. Delete group memberships for groups belonging to this club
    const { data: clubGroups } = await supabase
        .from('player_groups')
        .select('group_id')
        .eq('club_id', clubId)

    const groupIds = clubGroups?.map(g => g.group_id) || []

    if (groupIds.length > 0) {
        const { error: groupError } = await supabase
            .from('group_memberships')
            .delete()
            .eq('player_id', playerId)
            .in('group_id', groupIds)

        if (groupError) {
            console.error('Error deleting group memberships for club:', groupError)
            throw groupError
        }
    }

    // 3. Remove player from any matches in this club (Source of Truth: match_participations)
    if (matchIds.length > 0) {
        const { error: participationsError } = await supabase
            .from('match_participations')
            .delete()
            .eq('player_id', playerId)
            .in('match_id', matchIds)

        if (participationsError) {
            console.error('Error deleting match participations for club:', participationsError)
            throw participationsError
        }
    }

    // 4. Finally, remove the membership entry
    const { error: membershipError } = await supabase
        .from('club_members')
        .delete()
        .eq('player_id', playerId)
        .eq('club_id', clubId)

    if (membershipError) {
        console.error('Error removing club membership:', membershipError)
        throw membershipError
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

    const newElo = (data.level * 400) + 500
    const updates: Record<string, unknown> = {
        pro_verified: data.verified,
        declared_skill_level: data.level,
        adjusted_skill_level: data.level,
        elo_rating: newElo,
        elo_confidence: 5, // Set to established player confidence
    }

    if (data.verified) {
        updates.pro_verified_at = new Date().toISOString()
        updates.pro_verified_by = user.id
        updates.pro_verification_notes = data.notes
    }

    // 1. Get current rating for history
    const { data: currentPlayer } = await supabase
        .from('players')
        .select('elo_rating, adjusted_skill_level')
        .eq('player_id', playerId)
        .single()

    // 2. Perform the update
    const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('player_id', playerId)

    if (error) {
        console.error('Error verifying player:', error)
        throw error
    }

    // 3. Record Rating History
    await supabase.from('player_rating_history').insert({
        player_id: playerId,
        old_elo_rating: currentPlayer?.elo_rating,
        new_elo_rating: newElo,
        old_sync_rating: currentPlayer?.adjusted_skill_level,
        new_sync_rating: data.level,
        change_type: 'pro_verification',
        notes: data.notes || 'Pro verification'
    })

    revalidatePath('/dashboard')
}
