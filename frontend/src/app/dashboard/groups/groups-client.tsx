'use client'

import { useState } from 'react'
import { GroupModal } from './group-modal'
import { deleteGroup } from './actions'
import Link from 'next/link'

interface Group {
    group_id: string
    name: string
    description?: string
    member_count: number
}

interface GroupsClientProps {
    initialGroups: Group[]
    clubId: string
}

export function GroupsClient({ initialGroups, clubId }: GroupsClientProps) {
    const [groups, setGroups] = useState(initialGroups)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined)

    const handleDelete = async (groupId: string) => {
        if (confirm('Are you sure you want to delete this group? members will not be deleted, only the group.')) {
            try {
                await deleteGroup(groupId)
                window.location.reload()
            } catch (error) {
                console.error('Error deleting group:', error)
                alert('Failed to delete group')
            }
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Player Groups</h1>
                    <p className="text-gray-500 mt-1">Manage groups of players for invites and organization.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                    Create Group
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group) => (
                    <div key={group.group_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-medium text-gray-900 truncate pr-2" title={group.name}>
                                {group.name}
                            </h3>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => setEditingGroup(group)}
                                    className="text-gray-400 hover:text-indigo-600"
                                >
                                    <span className="sr-only">Edit</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDelete(group.group_id)}
                                    className="text-gray-400 hover:text-red-600"
                                >
                                    <span className="sr-only">Delete</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <p className="text-gray-500 text-sm mb-4 line-clamp-2 h-10">
                            {group.description || 'No description'}
                        </p>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <div className="text-sm text-gray-600">
                                <span className="font-medium text-gray-900">{group.member_count}</span> members
                            </div>
                            <Link
                                href={`/dashboard/groups/${group.group_id}`}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                            >
                                View Details
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No groups</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by creating a new group.</p>
                        <div className="mt-6">
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Create Group
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <GroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                mode="create"
                clubId={clubId}
            />

            {editingGroup && (
                <GroupModal
                    group={editingGroup}
                    isOpen={true}
                    onClose={() => setEditingGroup(undefined)}
                    mode="edit"
                />
            )}
        </div>
    )
}
