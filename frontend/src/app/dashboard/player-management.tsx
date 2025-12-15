'use client'

import { useState, useEffect } from 'react'
import { updatePlayer, createPlayer, togglePlayerStatus, deletePlayer } from './actions'
import { getClubs } from './get-clubs'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    active_status: boolean
    gender?: string
}

interface PlayerModalProps {
    player?: Player
    isOpen: boolean
    onClose: () => void
    mode: 'create' | 'edit'
    clubId?: string
}

export function PlayerModal({ player, isOpen, onClose, mode, clubId }: PlayerModalProps) {
    const [formData, setFormData] = useState({
        name: player?.name || '',
        phone_number: player?.phone_number || '',
        declared_skill_level: player?.declared_skill_level || 3.5,
        gender: player?.gender || '',
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            if (mode === 'edit' && player) {
                await updatePlayer(player.player_id, {
                    name: formData.name,
                    phone_number: formData.phone_number,
                    declared_skill_level: formData.declared_skill_level,
                    gender: formData.gender,
                })
            } else {
                await createPlayer({
                    name: formData.name,
                    phone_number: formData.phone_number,
                    declared_skill_level: formData.declared_skill_level,
                    gender: formData.gender,
                    club_id: clubId,
                })
            }
            onClose()
            window.location.reload() // Refresh to show changes
        } catch (error) {
            console.error('Error saving player:', error)
            alert('Failed to save player')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {mode === 'create' ? 'Add New Player' : 'Edit Player'}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            id="phone"
                            required
                            value={formData.phone_number}
                            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="+1234567890"
                        />
                    </div>

                    <div>
                        <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                            Skill Level
                        </label>
                        <select
                            id="level"
                            required
                            value={formData.declared_skill_level}
                            onChange={(e) => setFormData({ ...formData, declared_skill_level: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value={2.5}>2.5</option>
                            <option value={3.0}>3.0</option>
                            <option value={3.5}>3.5</option>
                            <option value={4.0}>4.0</option>
                            <option value={4.5}>4.5</option>
                            <option value={5.0}>5.0</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                            Gender
                        </label>
                        <select
                            id="gender"
                            required
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Select gender...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
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

interface PlayerActionsProps {
    player: Player
    onVerify?: () => void
}

export function PlayerActions({ player, onVerify }: PlayerActionsProps) {
    const [showModal, setShowModal] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)

    const handleToggleStatus = async () => {
        if (confirm(`Are you sure you want to ${player.active_status ? 'deactivate' : 'activate'} ${player.name}?`)) {
            await togglePlayerStatus(player.player_id, !player.active_status)
            window.location.reload()
        }
    }

    const handleDelete = async () => {
        if (confirm(`⚠️ PERMANENTLY DELETE ${player.name}?\n\nThis will also remove:\n• All their match invites\n• Group memberships\n• Match participations\n\nThis action cannot be undone!`)) {
            try {
                await deletePlayer(player.player_id)
                window.location.reload()
            } catch (error) {
                console.error('Error deleting player:', error)
                alert('Failed to delete player')
            }
        }
    }

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label="Actions"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>

                {showDropdown && (
                    <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                        <button
                            onClick={() => { setShowModal(true); setShowDropdown(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit
                        </button>

                        {onVerify && (
                            <button
                                onClick={() => { onVerify(); setShowDropdown(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Verify
                            </button>
                        )}

                        <button
                            onClick={() => { handleToggleStatus(); setShowDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${player.active_status ? 'text-orange-600' : 'text-green-600'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {player.active_status ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                )}
                            </svg>
                            {player.active_status ? 'Deactivate' : 'Activate'}
                        </button>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                            onClick={() => { handleDelete(); setShowDropdown(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                    </div>
                )}
            </div>
            <PlayerModal
                player={player}
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                mode="edit"
            />
        </>
    )
}
