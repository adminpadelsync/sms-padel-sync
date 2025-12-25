'use client'

import { useState, useEffect } from 'react'
import { CreateMatchButton } from '../create-match-button'

interface Match {
    match_id: string
    scheduled_time: string
    status: string
    team_1_players: string[]
    team_2_players: string[]
    club_id: string
    clubs?: {
        name: string
    }
    player_names?: string[]
    feedback_status?: string
    court_booked?: boolean
    originator_id?: string
    originator?: {
        name: string
        phone_number: string
        declared_skill_level: number
        adjusted_skill_level?: number
    }
    team_1_details?: PlayerDetail[]
    team_2_details?: PlayerDetail[]
}

interface PlayerDetail {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
}

interface MatchesClientProps {
    initialMatches: Match[]
    isSuperuser: boolean
    userClubId: string | null
    clubs: { club_id: string; name: string }[]
    userId: string
}

// Format date with day of week: "Mon, Dec 16, 4:00 PM"
function formatMatchTime(dateString: string): string {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }
    return date.toLocaleString('en-US', options)
}

function formatPhoneNumber(phone: string): string {
    if (!phone) return ''
    // Handle E.164 +1... format
    const cleaned = phone.replace(/\D/g, '')
    const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
    if (match) {
        return `(${match[2]}) ${match[3]}-${match[4]}`
    }
    return phone
}

export function MatchesClient({
    initialMatches,
    isSuperuser,
    userClubId,
    clubs,
    userId
}: MatchesClientProps) {
    const [mounted, setMounted] = useState(false)
    const [selectedClubId, setSelectedClubId] = useState<string>(() => {
        if (isSuperuser) {
            return userClubId || clubs[0]?.club_id || ''
        }
        return userClubId || ''
    })
    const [showCompletedMatches, setShowCompletedMatches] = useState(false)
    const [localMatches, setLocalMatches] = useState<Match[]>(initialMatches)
    const [markingBookedId, setMarkingBookedId] = useState<string | null>(null)

    // Update local matches if initialMatches changes
    useEffect(() => {
        setLocalMatches(initialMatches)
    }, [initialMatches])

    // After mount, check localStorage for saved club selection
    const [resendingId, setResendingId] = useState<string | null>(null)

    // ... (keep existing localStorage effect)
    useEffect(() => {
        setMounted(true)
        if (isSuperuser && typeof window !== 'undefined') {
            const stored = localStorage.getItem('selectedClubId')
            if (stored && clubs.find(c => c.club_id === stored)) {
                setSelectedClubId(stored)
            }
        }
    }, [isSuperuser, clubs])

    // Filter matches ...
    let filteredMatches = isSuperuser && mounted
        ? localMatches.filter(m => m.club_id === selectedClubId)
        : isSuperuser
            ? localMatches.filter(m => m.club_id === (userClubId || clubs[0]?.club_id))
            : localMatches

    if (!showCompletedMatches) {
        const now = new Date()
        filteredMatches = filteredMatches.filter(m =>
            m.status !== 'completed' &&
            m.status !== 'cancelled' &&
            new Date(m.scheduled_time) > now
        )
    }

    filteredMatches = filteredMatches.sort((a, b) =>
        new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
    )

    const handleMatchClick = (matchId: string) => {
        window.location.href = `/dashboard/matches/${matchId}`
    }

    const handleResendFeedback = async (e: React.MouseEvent, matchId: string) => {
        e.stopPropagation()
        if (confirm('Are you sure you want to resend feedback requests to all players?')) {
            setResendingId(matchId)
            try {
                const res = await fetch(`/api/matches/${matchId}/feedback?force=true`, {
                    method: 'POST'
                })
                if (!res.ok) throw new Error('Failed to resend')
                alert('Feedback requests resent successfully!')
            } catch (err) {
                console.error(err)
                alert('Error resending feedback requests')
            } finally {
                setResendingId(null)
            }
        }
    }

    const handleMarkAsBooked = async (e: React.MouseEvent, matchId: string) => {
        e.stopPropagation()
        if (!userClubId) return

        // 1. Check if match is confirmed
        const match = localMatches.find(m => m.match_id === matchId)
        if (match && match.status !== 'confirmed') {
            const proceed = window.confirm(
                "Warning: This match is not confirmed yet (needs 4 players). " +
                "Are you sure you want to book the court anyway?"
            )
            if (!proceed) return
        }

        setMarkingBookedId(matchId)
        try {
            const res = await fetch(`/api/matches/${matchId}/mark-booked`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }))
                throw new Error(errorData.detail || 'Failed to mark as booked')
            }

            // Update local state
            setLocalMatches(prev => prev.map(m =>
                m.match_id === matchId ? { ...m, court_booked: true } : m
            ))
        } catch (err: any) {
            console.error(err)
            alert(`Error: ${err.message || 'Could not mark match as booked'}. \n\nTip: Make sure you have applied the SQL migration in Supabase!`)
        } finally {
            setMarkingBookedId(null)
        }
    }

    // Matches that need booking: confirmed/pending, future, not booked
    const now = new Date()
    const bookingNeededMatches = filteredMatches.filter(m =>
        !m.court_booked &&
        (m.status === 'confirmed' || m.status === 'pending') &&
        new Date(m.scheduled_time) > now
    ).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
                        <p className="mt-1 text-sm text-gray-500">Manage and view all matches</p>
                    </div>
                    <CreateMatchButton clubId={selectedClubId} />
                </div>

                {/* Court Booking To-Do List (Only for unbooked future matches) */}
                {bookingNeededMatches.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Court Booking Requirements</h2>
                            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {bookingNeededMatches.length} Pending
                            </span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {bookingNeededMatches.map(match => (
                                <div
                                    key={match.match_id}
                                    className="bg-white p-5 rounded-xl border-l-4 border-l-red-500 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => handleMatchClick(match.match_id)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-sm font-bold text-indigo-600">
                                                {formatMatchTime(match.scheduled_time)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5 capitalize">
                                                Status: {match.status}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => handleMarkAsBooked(e, match.match_id)}
                                            disabled={markingBookedId === match.match_id}
                                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            {markingBookedId === match.match_id ? '...' : 'Mark Booked'}
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Originator Callout */}
                                        {match.originator && (
                                            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                                                <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Originator</p>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <p className="text-xs font-semibold text-blue-900">{match.originator.name}</p>
                                                    <p className="text-xs text-blue-700 font-mono">{formatPhoneNumber(match.originator.phone_number)}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Player List */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {[...(match.team_1_details || []), ...(match.team_2_details || [])].map((p, i) => (
                                                <div key={i} className="text-[11px] p-2 bg-gray-50 rounded border border-gray-100">
                                                    <p className="font-bold text-gray-900 truncate">{p?.name || 'Empty'}</p>
                                                    <div className="flex flex-col mt-0.5 text-gray-500">
                                                        <span>Lvl: {(p?.adjusted_skill_level || p?.declared_skill_level || 0).toFixed(2)}</span>
                                                        <span className="font-mono">{formatPhoneNumber(p?.phone_number || '')}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Matches Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={showCompletedMatches}
                                onChange={(e) => setShowCompletedMatches(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            Show past/cancelled matches
                        </label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Court</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredMatches && filteredMatches.length > 0 ? (
                                    filteredMatches.map((match) => (
                                        <tr
                                            key={match.match_id}
                                            onClick={() => handleMatchClick(match.match_id)}
                                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatMatchTime(match.scheduled_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${match.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                    match.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        match.status === 'voting' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {match.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${match.court_booked ? 'bg-indigo-100 text-indigo-800' : 'bg-red-50 text-red-700'
                                                    }`}>
                                                    {match.court_booked ? 'Booked' : 'Not Booked'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 align-top">
                                                {match.player_names && match.player_names.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {match.player_names.map((name, idx) => (
                                                            <span key={idx} className="whitespace-nowrap">{name}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span>{match.team_1_players.length + match.team_2_players.length} / 4</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap align-top">
                                                {match.feedback_status && (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${match.feedback_status === 'Received' ? 'bg-green-100 text-green-800' :
                                                            match.feedback_status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {match.feedback_status}
                                                        </span>
                                                        {match.feedback_status === 'Sent' && (
                                                            <button
                                                                onClick={(e) => handleResendFeedback(e, match.match_id)}
                                                                disabled={resendingId === match.match_id}
                                                                className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
                                                            >
                                                                {resendingId === match.match_id ? 'Sending...' : 'Resend'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No matches found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
