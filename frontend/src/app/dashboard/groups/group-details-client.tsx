'use client'

import { useState } from 'react'
import { GroupModal } from './group-modal'
import { AddToGroupModal } from './add-to-group-modal'
import { removeGroupMember, deleteGroup } from './actions'
import { PlayerActions } from '../player-management'
import { AddMembersModal } from './add-members-modal'
import { MatchWizard } from '../create-match-wizard'

interface Member {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
    added_at: string
    active_status: boolean
    gender?: string
}

interface Group {
    group_id: string
    name: string
    description?: string
    club_id: string
    visibility?: 'private' | 'open' | 'public'
}

interface GroupDetailsClientProps {
    group: Group
    members: Member[]
}

export function GroupDetailsClient({ group, members }: GroupDetailsClientProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false)
    const [isMatchWizardOpen, setIsMatchWizardOpen] = useState(false)
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
    const [currentMembers] = useState(members)

    const handleDeleteGroup = async () => {
        if (confirm('Are you sure you want to delete this group?')) {
            await deleteGroup(group.group_id)
            window.location.href = '/dashboard/groups'
        }
    }

    const handleRemoveMember = async (playerId: string) => {
        if (confirm('Remove this player from the group?')) {
            await removeGroupMember(group.group_id, playerId)
            // Ideally use optimistic update or router.refresh()
            // window.location.reload()
            // Let's rely on server action revalidatePath, but since this is client list state, 
            // if we use props it *should* update if page is re-rendered by nextjs.
            // But revalidatePath re-runs the page server component.
            // Client component will receive new props.
            // So we don't strictly need reload if Next.js handles it.
            // But for safety and visual feedback, reload is easiest for now.
            // Wait, revalidatePath updates the cached payload. 
            // We might need router.refresh() to fetch it.
            // Let's import useRouter.
            window.location.reload()
        }
    }

    return (
        <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
                <a href="/dashboard/groups" className="text-indigo-600 hover:text-indigo-800">
                    &larr; Back to Groups
                </a>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            {group.name}
                            {group.visibility === 'public' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Public
                                </span>
                            )}
                            {group.visibility === 'open' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Open
                                </span>
                            )}
                            {(group.visibility === 'private' || !group.visibility) && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Private
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-500 mt-2">{group.description || 'No description'}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Edit Details
                        </button>
                        <button
                            onClick={handleDeleteGroup}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-gray-300 rounded-md hover:bg-red-50"
                        >
                            Delete Group
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">
                        Members ({members.length})
                    </h2>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsMatchWizardOpen(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium flex items-center gap-2"
                        >
                            <span>🎾</span>
                            Create Match ({members.filter(m => m.active_status).length})
                        </button>
                        <button
                            onClick={() => setIsAddMemberModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                        >
                            Add Members
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added At</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {members.length > 0 ? (
                                members.map((member) => (
                                    <tr key={member.player_id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {member.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {member.phone_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {(member.adjusted_skill_level || member.declared_skill_level).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(member.added_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <button
                                                onClick={() => handleRemoveMember(member.player_id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        No members in this group.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <GroupModal
                group={group}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                mode="edit"
            />

            {/* 
                For Add Members, standard pattern would be a modal listing ALL players with checkbox.
                I can reuse AddToGroupModal if I change how it works or create a new "AddMemberModal".
                The AddToGroupModal takes playerIds and lets you choose a group.
                Here I have a group and want to choose players.
                So I need a specific "AddMembersToGroupModal" or generic "PlayerSelectorModal".
                
                Actually, I'll leverage the "Bulk Actions" approach user asked for? 
                User said "So I want to be able to create groups and then we're going to add players to those groups."
                And "Also add the ability to multi-select players in the grid of players and create a group from the selection or add the selected players to an existing group."
                
                This page "Group Details" should ideally have an "Add Member" button that opens a player picker.
                Since I don't have a reusable player picker yet, I will create a simple one here or just say "Use the Players list bulk action".
                But a button "Add Members" is expected on this page.
                
                I'll implement a simple "AddMemberModal" that lists active players in the club who are NOT in the group.
            */}
            <AddMembersModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                groupId={group.group_id}
                clubId={group.club_id}
                existingMemberIds={new Set(members.map(m => m.player_id))}
            />

            <MatchWizard
                isOpen={isMatchWizardOpen}
                onClose={() => setIsMatchWizardOpen(false)}
                clubId={group.club_id}
                initialSelectedPlayers={members.filter(m => m.active_status)}
            />
        </div>
    )
}
