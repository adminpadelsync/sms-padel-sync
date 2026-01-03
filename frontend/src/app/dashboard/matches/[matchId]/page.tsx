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
    court_booked?: boolean
    booked_court_text?: string
    originator_id?: string
}

interface Feedback {
    feedback_id: string
    match_id: string
    player_id: string
    rated_player_id: string
    rating: number
    comment?: string
    created_at: string
    rater?: { name: string }
    rated?: { name: string }
}

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted', icon: '✅' },
    declined: { bg: 'bg-red-100', text: 'text-red-800', label: 'Declined', icon: '❌' },
    maybe: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Maybe', icon: '🤔' },
    sent: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'No Response', icon: '⏳' },
    expired: { bg: 'bg-gray-200', text: 'text-gray-500', label: 'Expired', icon: '⌛' },
    removed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Removed', icon: '🚫' }
}

export default function MatchDetailPage() {
    const params = useParams()
    const router = useRouter()
    const matchId = params.matchId as string

    const [match, setMatch] = useState<Match | null>(null)
    const [invites, setInvites] = useState<Invite[]>([])
    const [feedback, setFeedback] = useState<Feedback[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    // For sending more invites
    const [showInvitePanel, setShowInvitePanel] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Player[]>([])
    const [selectedToInvite, setSelectedToInvite] = useState<Set<string>>(new Set())

    // For editing court booking
    const [isEditingBooking, setIsEditingBooking] = useState(false)
    const [editCourtBooked, setEditCourtBooked] = useState(false)
    const [editCourtText, setEditCourtText] = useState('')
    const [notifyPlayersOnUpdate, setNotifyPlayersOnUpdate] = useState(false)

    // Fetch match and invites
    useEffect(() => {
        async function fetchData() {
            try {
                const [matchRes, invitesRes, feedbackRes] = await Promise.all([
                    fetch(`/api/matches/${matchId}`),
                    fetch(`/api/matches/${matchId}/invites`),
                    fetch(`/api/matches/${matchId}/feedback`)
                ])

                if (matchRes.ok) {
                    const matchData = await matchRes.json()
                    setMatch(matchData.match)
                }

                if (invitesRes.ok) {
                    const invitesData = await invitesRes.json()
                    setInvites(invitesData.invites || [])
                }

                if (feedbackRes.ok) {
                    const feedbackData = await feedbackRes.json()
                    setFeedback(feedbackData.feedback || [])
                }
            } catch (error) {
                console.error('Error fetching match data:', error)
            } finally {
                setLoading(false)
            }
        }

        if (matchId) {
            fetchData()

            // Poll for updates every 5 seconds for live data
            const interval = setInterval(fetchData, 5000)
            return () => clearInterval(interval)
        }
    }, [matchId])

    // Search for players to invite
    useEffect(() => {
        async function searchPlayersApi() {
            if (searchTerm.length < 2 || !match) {
                setSearchResults([])
                return
            }

            try {
                const res = await fetch(`/api/players/search?club_id=${match.club_id}&q=${encodeURIComponent(searchTerm)}`)

                if (res.ok) {
                    const data = await res.json()
                    // Exclude already invited players and confirmed players
                    const alreadyInvitedIds = new Set(invites.map(i => i.player_id))
                    const allPlayerIds = new Set([
                        ...(match.team_1_players || []),
                        ...(match.team_2_players || [])
                    ])

                    const filtered = data.players.filter((p: Player) =>
                        !alreadyInvitedIds.has(p.player_id) &&
                        !allPlayerIds.has(p.player_id)
                    )
                    setSearchResults(filtered.slice(0, 10))
                }
            } catch (error) {
                console.error('Error searching players:', error)
            }
        }

        const debounce = setTimeout(searchPlayersApi, 300)
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

    const handleSaveBooking = async () => {
        if (!match) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    court_booked: editCourtBooked,
                    booked_court_text: editCourtText,
                    notify_players: notifyPlayersOnUpdate
                })
            })
            if (res.ok) {
                const data = await res.json()
                setMatch(data.match)
                setIsEditingBooking(false)
                setNotifyPlayersOnUpdate(false)
            }
        } catch (error) {
            console.error('Error saving booking info:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleRemovePlayer = async (playerId: string) => {
        if (!match || !confirm('Remove this player from the match?')) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/matches/${matchId}/players/${playerId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                // Refresh match data
                const matchRes = await fetch(`/api/matches/${matchId}`)
                if (matchRes.ok) {
                    const matchData = await matchRes.json()
                    setMatch(matchData.match)
                }
            }
        } catch (error) {
            console.error('Error removing player:', error)
        } finally {
            setActionLoading(false)
        }
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
                        onClick={() => router.push('/dashboard/matches')}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 inline-flex items-center transition-colors"
                    >
                        ← Back to Matches
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

                {/* Court Booking Section */}
                <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50/30">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${match.court_booked ? 'bg-green-100' : 'bg-red-100'}`}>
                                <span className="text-xl">{match.court_booked ? '🎾' : '⏳'}</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {match.court_booked ? 'Court Booked' : 'Court Not Booked'}
                                </h2>
                                {match.court_booked && match.booked_court_text && (
                                    <p className="text-indigo-600 font-semibold">{match.booked_court_text}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setIsEditingBooking(!isEditingBooking)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-md border border-indigo-200 hover:bg-indigo-50 transition-colors"
                        >
                            {isEditingBooking ? 'Cancel' : 'Edit Booking Detail'}
                        </button>
                    </div>

                    {isEditingBooking ? (
                        <div className="p-6 bg-indigo-50/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="court_booked"
                                            checked={editCourtBooked}
                                            onChange={(e) => setEditCourtBooked(e.target.checked)}
                                            className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="court_booked" className="text-sm font-medium text-gray-700">
                                            Court is officially booked
                                        </label>
                                    </div>
                                    <div>
                                        <label htmlFor="court_text" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                            Court Info (e.g. "Court 7")
                                        </label>
                                        <input
                                            type="text"
                                            id="court_text"
                                            value={editCourtText}
                                            onChange={(e) => setEditCourtText(e.target.value)}
                                            placeholder="Enter court number or location..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                        <input
                                            type="checkbox"
                                            id="notify_players"
                                            checked={notifyPlayersOnUpdate}
                                            onChange={(e) => setNotifyPlayersOnUpdate(e.target.checked)}
                                            className="h-5 w-5 mt-0.5 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                                        />
                                        <div>
                                            <label htmlFor="notify_players" className="text-sm font-bold text-yellow-800">
                                                Notify players via SMS?
                                            </label>
                                            <p className="text-xs text-yellow-700">
                                                Send a confirmation text to all players with the court info.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSaveBooking}
                                        disabled={actionLoading}
                                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-bold transition-shadow hover:shadow-lg"
                                    >
                                        {actionLoading ? 'Saving...' : 'Save Booking Info'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
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
                                            <button
                                                onClick={() => handleRemovePlayer(player.player_id)}
                                                disabled={actionLoading}
                                                className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                            >
                                                Remove
                                            </button>
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
                            {!showInvitePanel && (match.status === 'pending' || allPlayers.length < 4) && (
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

                {/* Feedback Section */}
                {feedback.length > 0 && (
                    <div className="mt-8 space-y-6">
                        {/* 1. Summary Cards */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-900">Feedback Summary</h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {allPlayers.map(player => {
                                        const received = feedback.filter(f => f.rated_player_id === player.player_id)
                                        const avgScore = received.length > 0
                                            ? (received.reduce((acc, curr) => acc + curr.rating, 0) / received.length).toFixed(1)
                                            : 'N/A'

                                        return (
                                            <div key={player.player_id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col h-full hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-3 mb-3 border-b border-gray-100 pb-3">
                                                    <div className="h-10 w-10 text-xl flex items-center justify-center bg-gray-200 rounded-full text-gray-600">
                                                        {/* Simple avatar placeholder */}
                                                        {player.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate" title={player.name}>{player.name}</p>
                                                        <p className="text-xs text-gray-500">Rec: {received.length}</p>
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Average</p>
                                                    <div className={`text-4xl font-bold ${avgScore === 'N/A' ? 'text-gray-300' :
                                                        Number(avgScore) >= 8 ? 'text-green-600' :
                                                            Number(avgScore) >= 6 ? 'text-yellow-600' : 'text-red-500'
                                                        }`}>
                                                        {avgScore}<span className="text-lg text-gray-400 font-normal">/10</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 mt-auto">
                                                    {received.map(f => (
                                                        <div key={f.feedback_id} className="flex items-center gap-2 text-xs bg-white p-1.5 rounded border border-gray-100">
                                                            <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full font-bold text-white ${f.rating >= 8 ? 'bg-green-500' : f.rating >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                                                                }`}>
                                                                {f.rating}
                                                            </span>
                                                            <span className="text-gray-600 truncate">
                                                                from {f.rater?.name || 'Unknown'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {received.length === 0 && (
                                                        <p className="text-xs text-gray-400 italic">No ratings yet</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 2. Detailed Matrix */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                <h2 className="text-lg font-medium text-gray-900">Detailed Feedback Matrix</h2>
                                <p className="text-sm text-gray-500">Rows: Player Rated (Receiver) • Columns: Rated By (Giver)</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-center">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 z-10 border-r">
                                                Player
                                            </th>
                                            {allPlayers.map(p => (
                                                <th key={p.player_id} className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[100px]">
                                                    Rated by<br />
                                                    <span className="text-blue-600">{p.name.split(' ')[0]}</span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {allPlayers.map((rowPlayer) => (
                                            <tr key={rowPlayer.player_id}>
                                                <td className="px-4 py-4 whitespace-nowrap text-left border-r bg-gray-50 sticky left-0 font-medium text-gray-900 text-sm">
                                                    {rowPlayer.name}
                                                </td>
                                                {allPlayers.map((colPlayer) => {
                                                    // Find feedback where Rater = colPlayer AND Rated = rowPlayer
                                                    const fb = feedback.find(f =>
                                                        f.player_id === colPlayer.player_id &&
                                                        f.rated_player_id === rowPlayer.player_id
                                                    )
                                                    const isSelf = rowPlayer.player_id === colPlayer.player_id

                                                    if (isSelf) {
                                                        return (
                                                            <td key={colPlayer.player_id} className="bg-gray-100/50 p-2">
                                                                <div className="w-full h-full min-h-[40px] flex items-center justify-center relative opacity-20">
                                                                    {/* Hashed pattern effect with CSS or SVG */}
                                                                    <svg width="100%" height="100%" className="absolute inset-0">
                                                                        <defs>
                                                                            <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                                                                <line x1="0" y1="0" x2="0" y2="10" style={{ stroke: 'black', strokeWidth: 1 }} />
                                                                            </pattern>
                                                                        </defs>
                                                                        <rect width="100%" height="100%" fill="url(#diagonalHatch)" />
                                                                    </svg>
                                                                </div>
                                                            </td>
                                                        )
                                                    }

                                                    return (
                                                        <td key={colPlayer.player_id} className="p-2 align-middle">
                                                            {fb ? (
                                                                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg font-bold shadow-sm ${fb.rating >= 8 ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                    fb.rating >= 6 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                                                        'bg-red-50 text-red-700 border border-red-200'
                                                                    }`}>
                                                                    {fb.rating}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 text-2xl">•</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
