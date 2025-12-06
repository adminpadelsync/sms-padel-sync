'use client'

import { useState, useEffect } from 'react'
import { searchPlayers } from './search-players'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    gender: string
}

interface Match {
    match_id: string
    club_id: string
    scheduled_time: string
    status: string
    team_1_players: string[]
    team_2_players: string[]
    team_1_player_details?: Player[]
    team_2_player_details?: Player[]
}

interface MatchDetailsModalProps {
    match: Match | null
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void
}

export function MatchDetailsModal({ match, isOpen, onClose, onUpdate }: MatchDetailsModalProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [scheduledTime, setScheduledTime] = useState('')
    const [status, setStatus] = useState('')
    const [showPlayerSearch, setShowPlayerSearch] = useState(false)
    const [playerSearchTerm, setPlayerSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Player[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (match) {
            setScheduledTime(match.scheduled_time)
            setStatus(match.status)
        }
    }, [match])

    // Search for players
    useEffect(() => {
        if (playerSearchTerm.length >= 2 && match) {
            searchPlayers(match.club_id, playerSearchTerm).then(setSearchResults)
        } else {
            setSearchResults([])
        }
    }, [playerSearchTerm, match])

    if (!isOpen || !match) return null

    // Combine all players into one list
    const allPlayers = [
        ...(match.team_1_player_details || []),
        ...(match.team_2_player_details || [])
    ]

    const handleSave = async () => {
        setLoading(true)
        try {
            const response = await fetch(`http://localhost:8001/api/matches/${match.match_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduled_time: scheduledTime,
                    status: status
                })
            })

            if (!response.ok) throw new Error('Failed to update match')

            setIsEditing(false)
            onUpdate()
        } catch (error) {
            console.error('Error updating match:', error)
            alert('Failed to update match')
        } finally {
            setLoading(false)
        }
    }

    const handleAddPlayer = async (playerId: string) => {
        setLoading(true)
        try {
            // Add to team 1 by default (teams don't matter per user feedback)
            const response = await fetch(`http://localhost:8001/api/matches/${match.match_id}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, team: 1 })
            })

            if (!response.ok) throw new Error('Failed to add player')

            setPlayerSearchTerm('')
            setSearchResults([])
            // Keep search open so user can add multiple players
            // setShowPlayerSearch(false)
            onUpdate()
        } catch (error) {
            console.error('Error adding player:', error)
            alert('Failed to add player')
        } finally {
            setLoading(false)
        }
    }

    const handleRemovePlayer = async (playerId: string) => {
        setLoading(true)
        try {
            const response = await fetch(`http://localhost:8001/api/matches/${match.match_id}/players/${playerId}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Failed to remove player')

            onUpdate()
        } catch (error) {
            console.error('Error removing player:', error)
            alert('Failed to remove player')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async () => {
        setLoading(true)
        try {
            const response = await fetch(`http://localhost:8001/api/matches/${match.match_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'confirmed' })
            })

            if (!response.ok) throw new Error('Failed to confirm match')

            onUpdate()
        } catch (error) {
            console.error('Error confirming match:', error)
            alert('Failed to confirm match')
        } finally {
            setLoading(false)
        }
    }

    const handleCancelMatch = async () => {
        if (!confirm('Are you sure you want to cancel this match?')) return

        setLoading(true)
        try {
            const response = await fetch(`http://localhost:8001/api/matches/${match.match_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' })
            })

            if (!response.ok) throw new Error('Failed to cancel match')

            onUpdate()
        } catch (error) {
            console.error('Error cancelling match:', error)
            alert('Failed to cancel match')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Match Details</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Match Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time</label>
                            {isEditing ? (
                                <input
                                    type="datetime-local"
                                    value={scheduledTime.slice(0, 16)}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            ) : (
                                <p className="text-gray-900 text-lg">{new Date(scheduledTime).toLocaleString()}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            {isEditing ? (
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="voting">Voting</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            ) : (
                                <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                    status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        status === 'voting' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                    }`}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Players List */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-medium text-gray-900">Players ({allPlayers.length}/4)</h3>
                            {isEditing && allPlayers.length < 4 && (
                                <button
                                    onClick={() => setShowPlayerSearch(true)}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    + Add Player
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {allPlayers.length > 0 ? (
                                allPlayers.map((player) => (
                                    <div key={player.player_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{player.name}</p>
                                            <p className="text-sm text-gray-500">Level {player.declared_skill_level}</p>
                                        </div>
                                        {isEditing && (
                                            <button
                                                onClick={() => handleRemovePlayer(player.player_id)}
                                                className="text-red-600 hover:text-red-800 font-medium"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-4">No players added yet</p>
                            )}
                        </div>
                    </div>

                    {/* Player Search */}
                    {showPlayerSearch && isEditing && (
                        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-medium text-gray-900">Add Player</h4>
                                <button
                                    onClick={() => {
                                        setShowPlayerSearch(false)
                                        setPlayerSearchTerm('')
                                        setSearchResults([])
                                    }}
                                    className="text-sm text-gray-600 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Search players by name..."
                                value={playerSearchTerm}
                                onChange={(e) => setPlayerSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:ring-indigo-500 focus:border-indigo-500"
                                autoFocus
                            />
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {searchResults.map((player) => (
                                    <button
                                        key={player.player_id}
                                        onClick={() => handleAddPlayer(player.player_id)}
                                        className="w-full text-left p-2 hover:bg-white rounded transition-colors"
                                    >
                                        <p className="font-medium text-gray-900">{player.name}</p>
                                        <p className="text-sm text-gray-500">Level {player.declared_skill_level}</p>
                                    </button>
                                ))}
                                {playerSearchTerm.length >= 2 && searchResults.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-2">No players found</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex gap-3">
                        {!isEditing && status !== 'confirmed' && (
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                Confirm Match
                            </button>
                        )}
                        {!isEditing && status !== 'cancelled' && (
                            <button
                                onClick={handleCancelMatch}
                                disabled={loading}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                Cancel Match
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => {
                                        setIsEditing(false)
                                        setShowPlayerSearch(false)
                                        setPlayerSearchTerm('')
                                    }}
                                    disabled={loading}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                            >
                                Edit Match
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
