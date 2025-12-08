'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    gender?: string
}

interface Invite {
    invite_id: string
    match_id: string
    player_id: string
    status: 'sent' | 'accepted' | 'declined' | 'expired' | 'maybe'
    sent_at: string
    responded_at: string | null
    player?: Player
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

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted', icon: '✅' },
    declined: { bg: 'bg-red-100', text: 'text-red-800', label: 'Declined', icon: '❌' },
    maybe: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Maybe', icon: '🤔' },
    sent: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'No Response', icon: '⏳' },
    expired: { bg: 'bg-gray-200', text: 'text-gray-500', label: 'Expired', icon: '⌛' }
}

export default function MatchDetailPage() {
    const params = useParams()
    const router = useRouter()
    const matchId = params.matchId as string

    const [match, setMatch] = useState<Match | null>(null)
    const [invites, setInvites] = useState<Invite[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    // For sending more invites
    const [showInvitePanel, setShowInvitePanel] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Player[]>([])
    const [selectedToInvite, setSelectedToInvite] = useState<Set<string>>(new Set())

    // Fetch match and invites
    useEffect(() => {
        async function fetchData() {
            try {
                const [matchRes, invitesRes] = await Promise.all([
                    fetch(`/api/matches/${matchId}`),
                    fetch(`/api/matches/${matchId}/invites`)
                ])

                if (matchRes.ok) {
                    const matchData = await matchRes.json()
                    setMatch(matchData.match)
                }

                if (invitesRes.ok) {
                    const invitesData = await invitesRes.json()
                    setInvites(invitesData.invites || [])
                }
            } catch (error) {
                console.error('Error fetching match data:', error)
            } finally {
                setLoading(false)
            }
        }

        if (matchId) {
            fetchData()
        }
    }, [matchId])

    // Search for players to invite
    useEffect(() => {
        async function searchPlayers() {
            if (searchTerm.length < 2 || !match) {
                setSearchResults([])
                return
            }

            try {
                const res = await fetch(`/api/recommendations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        club_id: match.club_id,
                        target_level: 3.5, // Default, will search broadly
                        gender_preference: 'mixed',
                        exclude_player_ids: []
                    })
                })

                if (res.ok) {
                    const data = await res.json()
                    // Filter by search term and exclude already invited players
                    const alreadyInvitedIds = new Set(invites.map(i => i.player_id))
                    const allPlayerIds = new Set([
                        ...(match.team_1_players || []),
                        ...(match.team_2_players || [])
                    ])

                    const filtered = data.players.filter((p: Player) =>
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                        !alreadyInvitedIds.has(p.player_id) &&
                        !allPlayerIds.has(p.player_id)
                    )
                    setSearchResults(filtered.slice(0, 10))
                }
            } catch (error) {
                console.error('Error searching players:', error)
            }
        }

        const debounce = setTimeout(searchPlayers, 300)
        return () => clearTimeout(debounce)
    }, [searchTerm, match, invites])

    const handleConfirmMatch = async () => {
        if (!match) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'confirmed' })
            })
            if (res.ok) {
                setMatch(prev => prev ? { ...prev, status: 'confirmed' } : null)
            }
        } catch (error) {
            console.error('Error confirming match:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleCancelMatch = async () => {
        if (!match || !confirm('Are you sure you want to cancel this match?')) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' })
            })
            if (res.ok) {
                setMatch(prev => prev ? { ...prev, status: 'cancelled' } : null)
            }
        } catch (error) {
            console.error('Error cancelling match:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleSendInvites = async () => {
        if (!match || selectedToInvite.size === 0) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/matches/${matchId}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_ids: Array.from(selectedToInvite)
                })
            })

            if (res.ok) {
                // Refresh invites
                const invitesRes = await fetch(`/api/matches/${matchId}/invites`)
                if (invitesRes.ok) {
                    const invitesData = await invitesRes.json()
                    setInvites(invitesData.invites || [])
                }
                setSelectedToInvite(new Set())
                setSearchTerm('')
                setShowInvitePanel(false)
            }
        } catch (error) {
            console.error('Error sending invites:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const togglePlayerSelection = (playerId: string) => {
        const newSet = new Set(selectedToInvite)
        if (newSet.has(playerId)) {
            newSet.delete(playerId)
        } else {
            newSet.add(playerId)
        }
        setSelectedToInvite(newSet)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-500">Loading match details...</div>
            </div>
        )
    }

    if (!match) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Match not found</h2>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-indigo-600 hover:text-indigo-800"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const allPlayers = [
        ...(match.team_1_player_details || []),
        ...(match.team_2_player_details || [])
    ]

    const formattedTime = new Date(match.scheduled_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 inline-flex items-center"
                    >
                        ← Back to Dashboard
                    </button>

                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Match: {formattedTime}
                            </h1>
                            <div className="mt-2 flex items-center gap-3">
                                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${match.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                        match.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            match.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                    }`}>
                                    {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                                </span>
                                <span className="text-gray-500">
                                    {allPlayers.length}/4 players confirmed
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {match.status === 'pending' && (
                                <button
                                    onClick={handleConfirmMatch}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Confirm Match
                                </button>
                            )}
                            {match.status !== 'cancelled' && (
                                <button
                                    onClick={handleCancelMatch}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    Cancel Match
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Confirmed Players */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900">
                                Confirmed Players ({allPlayers.length}/4)
                            </h2>
                        </div>
                        <div className="p-6">
                            {allPlayers.length > 0 ? (
                                <div className="space-y-3">
                                    {allPlayers.map((player) => (
                                        <div key={player.player_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                                            <div className="flex items-center gap-3">
                                                <span className="text-green-600 text-lg">✅</span>
                                                <div>
                                                    <p className="font-medium text-gray-900">{player.name}</p>
                                                    <p className="text-sm text-gray-500">Level {player.declared_skill_level}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No players confirmed yet</p>
                            )}

                            {allPlayers.length < 4 && (
                                <p className="text-sm text-gray-500 mt-4 text-center">
                                    Waiting for {4 - allPlayers.length} more player{4 - allPlayers.length > 1 ? 's' : ''}...
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Invites */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-lg font-medium text-gray-900">
                                Invites Sent ({invites.length})
                            </h2>
                            {!showInvitePanel && (
                                <button
                                    onClick={() => setShowInvitePanel(true)}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    + Send More Invites
                                </button>
                            )}
                        </div>

                        <div className="p-6">
                            {/* Send More Invites Panel */}
                            {showInvitePanel && (
                                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-medium text-gray-900">Send More Invites</h3>
                                        <button
                                            onClick={() => {
                                                setShowInvitePanel(false)
                                                setSearchTerm('')
                                                setSelectedToInvite(new Set())
                                            }}
                                            className="text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Search players by name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:ring-indigo-500 focus:border-indigo-500"
                                        autoFocus
                                    />

                                    {searchResults.length > 0 && (
                                        <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                                            {searchResults.map((player) => (
                                                <div
                                                    key={player.player_id}
                                                    onClick={() => togglePlayerSelection(player.player_id)}
                                                    className={`p-2 rounded cursor-pointer transition-colors ${selectedToInvite.has(player.player_id)
                                                            ? 'bg-indigo-100 border border-indigo-300'
                                                            : 'bg-white hover:bg-gray-50 border border-gray-200'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedToInvite.has(player.player_id)}
                                                            onChange={() => { }}
                                                            className="h-4 w-4 text-indigo-600 rounded"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-gray-900">{player.name}</p>
                                                            <p className="text-sm text-gray-500">Level {player.declared_skill_level}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedToInvite.size > 0 && (
                                        <button
                                            onClick={handleSendInvites}
                                            disabled={actionLoading}
                                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
                                        >
                                            Send Invites ({selectedToInvite.size})
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Invite List */}
                            {invites.length > 0 ? (
                                <div className="space-y-2">
                                    {invites.map((invite) => {
                                        const config = statusConfig[invite.status] || statusConfig.sent

                                        return (
                                            <div key={invite.invite_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">{config.icon}</span>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {invite.player?.name || 'Unknown Player'}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Level {invite.player?.declared_skill_level || '?'}
                                                            {invite.responded_at && (
                                                                <span className="ml-2">
                                                                    • {new Date(invite.responded_at).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
                                                    {config.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No invites sent yet</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
