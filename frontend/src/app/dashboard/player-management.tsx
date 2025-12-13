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
}

export function PlayerActions({ player }: PlayerActionsProps) {
    const [showModal, setShowModal] = useState(false)

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
            <div className="flex gap-2">
                <button
                    onClick={() => setShowModal(true)}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                >
                    Edit
                </button>
                <button
                    onClick={handleToggleStatus}
                    className={`text-sm font-medium ${player.active_status ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'
                        }`}
                >
                    {player.active_status ? 'Deactivate' : 'Activate'}
                </button>
                <button
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                >
                    Delete
                </button>
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
