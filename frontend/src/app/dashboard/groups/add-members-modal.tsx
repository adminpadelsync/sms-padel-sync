'use client'

import { useState, useEffect } from 'react'
import { getClubPlayers, addGroupMembers } from './actions'

interface AddMembersModalProps {
    isOpen: boolean
    onClose: () => void
    groupId: string
    clubId: string
    existingMemberIds: Set<string>
}

interface Player {
    player_id: string
    name: string
    declared_skill_level: number
    adjusted_skill_level?: number
}

export function AddMembersModal({ isOpen, onClose, groupId, clubId, existingMemberIds }: AddMembersModalProps) {
    const [players, setPlayers] = useState<Player[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (isOpen && clubId) {
            loadPlayers()
            setSelectedIds(new Set())
            setSearchQuery('')
        }
    }, [isOpen, clubId])

    const loadPlayers = async () => {
        setIsLoading(true)
        try {
            const data = await getClubPlayers(clubId)
            // Filter out existing members
            const available = data.filter((p: Player) => !existingMemberIds.has(p.player_id))
            setPlayers(available)
        } catch (error) {
            console.error('Error loading players:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedIds.size === 0) return

        setIsSubmitting(true)
        try {
            await addGroupMembers(groupId, Array.from(selectedIds))
            onClose()
            window.location.reload()
        } catch (error) {
            console.error('Error adding members:', error)
            alert('Failed to add members')
        } finally {
            setIsSubmitting(false)
        }
    }

    const toggleSelection = (playerId: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(playerId)) {
            newSelected.delete(playerId)
        } else {
            newSelected.add(playerId)
        }
        setSelectedIds(newSelected)
    }

    const filteredPlayers = players.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Add Members to Group
                    </h3>
                </div>

                <div className="px-6 py-4 flex-1 overflow-hidden flex flex-col">
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search players..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-[200px] border border-gray-200 rounded-md">
                        {isLoading ? (
                            <div className="text-center py-4 text-gray-500">Loading players...</div>
                        ) : filteredPlayers.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                                {searchQuery ? 'No players found matching search.' : 'All active players are already in this group.'}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredPlayers.map((player) => (
                                    <label
                                        key={player.player_id}
                                        className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${selectedIds.has(player.player_id) ? 'bg-indigo-50' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(player.player_id)}
                                            onChange={() => toggleSelection(player.player_id)}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-3"
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{player.name}</div>
                                            <div className="text-xs text-gray-500">Level: {(player.adjusted_skill_level || player.declared_skill_level).toFixed(2)}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-2 text-sm text-gray-500 text-right">
                        {selectedIds.size} selected
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || selectedIds.size === 0}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adding...' : 'Add Selected'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
