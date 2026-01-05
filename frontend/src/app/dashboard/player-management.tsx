'use client'

import { useState, useEffect } from 'react'
import { updatePlayer, createPlayer, togglePlayerStatus, removePlayerFromClub } from './actions'
import { getClubs } from './get-clubs'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
    active_status: boolean
    gender?: string
    avail_weekday_morning?: boolean
    avail_weekday_afternoon?: boolean
    avail_weekday_evening?: boolean
    avail_weekend_morning?: boolean
    avail_weekend_afternoon?: boolean
    avail_weekend_evening?: boolean
    club_id?: string
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
        avail_weekday_morning: player?.avail_weekday_morning || false,
        avail_weekday_afternoon: player?.avail_weekday_afternoon || false,
        avail_weekday_evening: player?.avail_weekday_evening || false,
        avail_weekend_morning: player?.avail_weekend_morning || false,
        avail_weekend_afternoon: player?.avail_weekend_afternoon || false,
        avail_weekend_evening: player?.avail_weekend_evening || false,
        active_status: player ? player.active_status : true,
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const skillLevel = parseFloat(formData.declared_skill_level.toString()) || 0

            if (mode === 'edit' && player) {
                await updatePlayer(player.player_id, {
                    name: formData.name,
                    phone_number: formData.phone_number,
                    declared_skill_level: skillLevel,
                    gender: formData.gender,
                    avail_weekday_morning: formData.avail_weekday_morning,
                    avail_weekday_afternoon: formData.avail_weekday_afternoon,
                    avail_weekday_evening: formData.avail_weekday_evening,
                    avail_weekend_morning: formData.avail_weekend_morning,
                    avail_weekend_afternoon: formData.avail_weekend_afternoon,
                    avail_weekend_evening: formData.avail_weekend_evening,
                    active_status: formData.active_status,
                })
            } else {
                await createPlayer({
                    name: formData.name,
                    phone_number: formData.phone_number,
                    declared_skill_level: skillLevel,
                    gender: formData.gender,
                    club_id: clubId,
                    avail_weekday_morning: formData.avail_weekday_morning,
                    avail_weekday_afternoon: formData.avail_weekday_afternoon,
                    avail_weekday_evening: formData.avail_weekday_evening,
                    avail_weekend_morning: formData.avail_weekend_morning,
                    avail_weekend_afternoon: formData.avail_weekend_afternoon,
                    avail_weekend_evening: formData.avail_weekend_evening,
                    active_status: formData.active_status,
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
                            Skill Level (2.0 - 7.0)
                        </label>
                        <input
                            type="text"
                            id="level"
                            required
                            value={formData.declared_skill_level}
                            onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty, numbers, and a single decimal point
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setFormData({ ...formData, declared_skill_level: val as any });
                                }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. 3.5"
                        />
                        {player?.adjusted_skill_level && (
                            <p className="mt-1 text-xs text-indigo-600 font-semibold">
                                Current Sync Rating: {player.adjusted_skill_level.toFixed(2)}
                            </p>
                        )}
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

                    <div className="border-t border-gray-100 pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 mb-2 text-center">
                                <span className="text-left pl-2">When</span>
                                <span>Morning</span>
                                <span>Afternoon</span>
                                <span>Evening</span>
                            </div>

                            {/* Weekdays Row */}
                            <div className="grid grid-cols-4 gap-2 items-center mb-2">
                                <span className="text-sm font-medium text-gray-700 pl-2">Weekdays</span>
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.avail_weekday_morning}
                                        onChange={(e) => setFormData({ ...formData, avail_weekday_morning: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.avail_weekday_afternoon}
                                        onChange={(e) => setFormData({ ...formData, avail_weekday_afternoon: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.avail_weekday_evening}
                                        onChange={(e) => setFormData({ ...formData, avail_weekday_evening: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                            </div>

                            {/* Weekends Row */}
                            <div className="grid grid-cols-4 gap-2 items-center">
                                <span className="text-sm font-medium text-gray-700 pl-2">Weekends</span>
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.avail_weekend_morning}
                                        onChange={(e) => setFormData({ ...formData, avail_weekend_morning: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.avail_weekend_afternoon}
                                        onChange={(e) => setFormData({ ...formData, avail_weekend_afternoon: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.avail_weekend_evening}
                                        onChange={(e) => setFormData({ ...formData, avail_weekend_evening: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="active_status"
                            checked={formData.active_status}
                            onChange={(e) => setFormData({ ...formData, active_status: e.target.checked })}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="active_status" className="text-sm text-gray-700">
                            Active (Receive Invites)
                        </label>
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
    const [showDropdown, setShowDropdown] = useState(false)

    const handleToggleStatus = async () => {
        if (confirm(`Are you sure you want to ${player.active_status ? 'deactivate' : 'activate'} ${player.name}?`)) {
            await togglePlayerStatus(player.player_id, !player.active_status)
            window.location.reload()
        }
    }

    const handleRemoveFromClub = async () => {
        const clubId = player.club_id
        if (!clubId) {
            alert('Cannot remove player: Missing club context')
            return
        }

        if (confirm(`⚠️ REMOVE ${player.name} FROM THIS CLUB?\n\nThis will also remove their:\n• Match invites at this club\n• Group memberships at this club\n• Upcoming match participations at this club\n\nThey will still remain in Padel Sync and any other clubs they belong to.\n\nContinue?`)) {
            try {
                await removePlayerFromClub(player.player_id, clubId)
                window.location.reload()
            } catch (error) {
                console.error('Error removing player:', error)
                alert('Failed to remove player from club')
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
                            onClick={() => { handleRemoveFromClub(); setShowDropdown(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove from Club
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
