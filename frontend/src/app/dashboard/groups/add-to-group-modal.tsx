'use client'

import { useState, useEffect } from 'react'
import { getClubGroups, addGroupMembers } from './actions'

interface AddToGroupModalProps {
    isOpen: boolean
    onClose: () => void
    clubId: string
    playerIds: string[]
}

interface Group {
    group_id: string
    name: string
    member_count: number
}

export function AddToGroupModal({ isOpen, onClose, clubId, playerIds }: AddToGroupModalProps) {
    const [groups, setGroups] = useState<Group[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen && clubId) {
            console.log('AddToGroupModal opening. Club ID:', clubId)
            loadGroups()
        } else if (isOpen) {
            console.warn('AddToGroupModal opened but clubId is missing/falsy:', clubId)
        }
    }, [isOpen, clubId])

    const loadGroups = async () => {
        setIsLoading(true)
        try {
            const data = await getClubGroups(clubId)
            setGroups(data)
            if (data.length > 0) {
                setSelectedGroupId(data[0].group_id)
            }
        } catch (error) {
            console.error('Error loading groups:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedGroupId) return

        setIsSubmitting(true)
        try {
            await addGroupMembers(selectedGroupId, playerIds)
            onClose()
            window.location.reload()
        } catch (error) {
            console.error('Error adding members:', error)
            alert('Failed to add members to group')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Add {playerIds.length} Player{playerIds.length !== 1 ? 's' : ''} to Group
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    {isLoading ? (
                        <div className="text-center py-4 text-gray-500">Loading groups...</div>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                            No groups found. Please create a group first.
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-1">
                                Select Group
                            </label>
                            <select
                                id="group"
                                required
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {groups.map((group) => (
                                    <option key={group.group_id} value={group.group_id}>
                                        {group.name} ({group.member_count} members)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || groups.length === 0}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adding...' : 'Add Members'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
