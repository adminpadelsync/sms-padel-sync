'use client'

import { useState } from 'react'
import { createGroup, updateGroup } from './actions'

interface Group {
    group_id: string
    name: string
    description?: string
}

interface GroupModalProps {
    group?: Group
    isOpen: boolean
    onClose: () => void
    mode: 'create' | 'edit'
    clubId?: string
    initialMemberIds?: string[]
}

export function GroupModal({ group, isOpen, onClose, mode, clubId, initialMemberIds }: GroupModalProps) {
    const [formData, setFormData] = useState({
        name: group?.name || '',
        description: group?.description || '',
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            if (mode === 'edit' && group) {
                await updateGroup(group.group_id, {
                    name: formData.name,
                    description: formData.description,
                })
            } else if (clubId) {
                console.log('Creating group for Club ID:', clubId)
                await createGroup({
                    name: formData.name,
                    description: formData.description,
                    club_id: clubId,
                    initial_member_ids: initialMemberIds,
                })
            }
            onClose()
            // Optional: Actions do revalidatePath, but client update might need reload if not using router.refresh() 
            // usually revalidatePath updates server component prop, but here we might need manual refresh if generic.
            // But this modal will be likely properly hydrated.
            // Let's reload to be safe like in player-management.tsx
            window.location.reload()
        } catch (error) {
            console.error('Error saving group:', error)
            alert('Failed to save group')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {mode === 'create' ? 'Create New Group' : 'Edit Group'}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Group Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Intermediate Players"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="description"
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Optional description..."
                        />
                    </div>

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
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
