'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function getClubGroups(clubId: string) {
    console.log('getClubGroups called with clubId:', clubId, typeof clubId)
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('player_groups')
        .select(`
            *,
            members:group_memberships(player_id)
        `)
        .eq('club_id', clubId)
        .order('name')

    if (error) {
        // Log full error details, handling both PostgREST objects and native Errors
        console.error('Error fetching groups:', error)
        if (error instanceof Error) {
            console.error('Error message:', error.message)
            console.error('Stack:', error.stack)
        } else {
            console.error('Full error object:', JSON.stringify(error, null, 2))
        }
        return []
    }

    return data.map(g => ({
        ...g,
        member_count: g.members?.length || 0
    }))
}

export async function createGroup(data: {
    name: string
    description: string
    club_id: string
    visibility?: 'private' | 'open' | 'public'
    initial_member_ids?: string[]
}) {
    const supabase = await createClient()

    // 1. Create Group
    const { data: group, error: groupError } = await supabase
        .from('player_groups')
        .insert({
            name: data.name,
            description: data.description,
            club_id: data.club_id,
            visibility: data.visibility || 'private'
        })
        .select()
        .single()

    if (groupError) {
        console.error('Error creating group:', groupError)
        throw groupError
    }

    // 2. Add members if any
    if (data.initial_member_ids && data.initial_member_ids.length > 0) {
        const membersData = data.initial_member_ids.map(playerId => ({
            group_id: group.group_id,
            player_id: playerId
        }))

        const { error: membersError } = await supabase
            .from('group_memberships')
            .insert(membersData)

        if (membersError) {
            console.error('Error adding initial members:', membersError)
            // Note: Group was created, but members failed. 
            // Ideally we'd rollback but Supabase HTTP client doesn't support transactions easily here.
            // We'll throw so UI can show partial error.
            throw membersError
        }
    }

    revalidatePath('/dashboard/groups')
    return group
}

export async function updateGroup(groupId: string, data: { name: string, description: string, visibility?: 'private' | 'open' | 'public' }) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('player_groups')
        .update(data)
        .eq('group_id', groupId)

    if (error) throw error
    revalidatePath('/dashboard/groups')
}

export async function deleteGroup(groupId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('player_groups')
        .delete()
        .eq('group_id', groupId)

    if (error) throw error
    revalidatePath('/dashboard/groups')
}

export async function getGroupDetails(groupId: string) {
    const supabase = await createClient()

    // Get group info
    const { data: group, error: groupError } = await supabase
        .from('player_groups')
        .select('*')
        .eq('group_id', groupId)
        .single()

    if (groupError) throw groupError

    // Get members with detailed player info
    const { data: memberships, error: membersError } = await supabase
        .from('group_memberships')
        .select(`
            added_at,
            player:players (
                player_id,
                name,
                phone_number,
                declared_skill_level,
                adjusted_skill_level,
                gender,
                active_status
            )
        `)
        .eq('group_id', groupId)

    if (membersError) throw membersError

    // Flatten and sort
    const members = memberships
        .map((m: any) => ({
            ...m.player,
            added_at: m.added_at
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

    return { group, members }
}

export async function addGroupMembers(groupId: string, playerIds: string[]) {
    const supabase = await createClient()

    // Filter existing members
    const { data: existing } = await supabase
        .from('group_memberships')
        .select('player_id')
        .eq('group_id', groupId)
        .in('player_id', playerIds)

    const existingIds = new Set(existing?.map(m => m.player_id) || [])
    const newIds = playerIds.filter(id => !existingIds.has(id))

    if (newIds.length > 0) {
        const { error } = await supabase
            .from('group_memberships')
            .insert(newIds.map(pid => ({
                group_id: groupId,
                player_id: pid
            })))

        if (error) throw error
    }

    revalidatePath(`/dashboard/groups/${groupId}`)
    revalidatePath('/dashboard/groups')
}

export async function removeGroupMember(groupId: string, playerId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('group_memberships')
        .delete()
        .match({ group_id: groupId, player_id: playerId })

    if (error) throw error

    revalidatePath(`/dashboard/groups/${groupId}`)
    revalidatePath('/dashboard/groups')
}

export async function getClubPlayers(clubId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('players')
        .select('player_id, name, phone_number, declared_skill_level, adjusted_skill_level, active_status')
        .eq('club_id', clubId)
        .eq('active_status', true)
        .order('name')

    if (error) {
        console.error('Error fetching players:', error)
        return []
    }

    return data || []
}
