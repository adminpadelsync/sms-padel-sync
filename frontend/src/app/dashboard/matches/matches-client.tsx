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
        timezone?: string
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
    score_text?: string
    winner_team?: number
    booked_court_text?: string
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
    userClubId: string | null
    userId: string
    userClubTimezone?: string | null
}

// Format date with day of week in a specific timezone: "Mon, Dec 16, 4:00 PM"
function formatMatchTime(dateString: string, timeZone?: string): string {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timeZone || undefined
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
    userClubId,
    userId,
    userClubTimezone
}: MatchesClientProps) {
    const [showOlderMatches, setShowOlderMatches] = useState(false)
    const [localMatches, setLocalMatches] = useState<Match[]>(initialMatches)
    const [markingBookedId, setMarkingBookedId] = useState<string | null>(null)
    const [resendingId, setResendingId] = useState<string | null>(null)

    // Update local matches if initialMatches changes
    useEffect(() => {
        setLocalMatches(initialMatches)
    }, [initialMatches])

    // Filter matches
    let filteredMatches = localMatches.filter((m: Match) => m.club_id === userClubId)

    if (!showOlderMatches) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(0, 0, 0, 0)

        filteredMatches = filteredMatches.filter((m: Match) =>
            new Date(m.scheduled_time) >= yesterday
        )
    }

    filteredMatches = filteredMatches.sort((a: Match, b: Match) =>
        new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime()
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

        const match = localMatches.find((m: Match) => m.match_id === matchId)
        if (match && match.status !== 'confirmed') {
            const proceed = window.confirm(
                "Warning: This match is not confirmed yet (needs 4 players). " +
                "Are you sure you want to book the court anyway?"
            )
            if (!proceed) return
        }

        const matchTime = match ? formatMatchTime(match.scheduled_time, match.clubs?.timezone || userClubTimezone || undefined) : 'this match'
        const courtText = window.prompt(
            `Marking match on ${matchTime} as booked.\n\n` +
            `Please enter the court details (e.g. "Court 6"):`,
            ""
        )

        if (courtText === null) return

        setMarkingBookedId(matchId)
        try {
            const res = await fetch(`/api/matches/${matchId}/mark-booked`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    court_text: courtText
                })
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }))
                throw new Error(errorData.detail || 'Failed to mark as booked')
            }

            setLocalMatches((prev: Match[]) => prev.map((m: Match) =>
                m.match_id === matchId ? {
                    ...m,
                    court_booked: true,
                    booked_court_text: courtText || m.booked_court_text
                } : m
            ))
        } catch (err) {
            const error = err as Error
            console.error(error)
            alert(`Error: ${error.message || 'Could not mark match as booked'}.`)
        } finally {
            setMarkingBookedId(null)
        }
    }

    const now = new Date()
    const bookingNeededMatches = filteredMatches.filter((m: Match) =>
        !m.court_booked &&
        (m.status === 'confirmed' || m.status === 'pending') &&
        new Date(m.scheduled_time) > now
    ).sort((a: Match, b: Match) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
                        <p className="mt-1 text-sm text-gray-500">Manage and view all matches</p>
                    </div>
                    <CreateMatchButton clubId={userClubId || ''} />
                </div>

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
                                                {formatMatchTime(match.scheduled_time, match.clubs?.timezone || userClubTimezone || undefined)}
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
                                        {match.originator && (
                                            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                                                <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Originator</p>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <p className="text-xs font-semibold text-blue-900">{match.originator.name}</p>
                                                    <p className="text-xs text-blue-700 font-mono">{formatPhoneNumber(match.originator.phone_number)}</p>
                                                </div>
                                            </div>
                                        )}

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

                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={showOlderMatches}
                                onChange={(e) => setShowOlderMatches(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            Show matches prior to yesterday
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredMatches && filteredMatches.length > 0 ? (
                                    filteredMatches.map((match) => {
                                        const sets = match.score_text
                                            ? match.score_text.split(',').map(s => {
                                                const parts = s.trim().split('-')
                                                return [parts[0] || '', parts[1] || '']
                                            })
                                            : []

                                        const winner = match.winner_team

                                        const renderScorecard = () => (
                                            <div className="border border-gray-200 rounded-lg overflow-hidden text-sm bg-white w-full max-w-md">
                                                <div className="flex border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                    <div className="flex-1 px-3 py-1">Team</div>
                                                    {sets.length > 0 ? sets.map((_, i) => (
                                                        <div key={i} className="w-8 text-center py-1 border-l border-gray-100">S{i + 1}</div>
                                                    )) : (
                                                        <div className="w-8 text-center py-1 border-l border-gray-100">-</div>
                                                    )}
                                                </div>

                                                {[1, 2].map((teamNum) => {
                                                    const isWinner = winner === teamNum
                                                    const players = teamNum === 1 ? match.team_1_details : match.team_2_details
                                                    const regularPlayers = teamNum === 1 ? match.team_1_players : match.team_2_players

                                                    return (
                                                        <div
                                                            key={teamNum}
                                                            className={`flex items-center border-b last:border-0 border-gray-50 ${isWinner ? 'bg-green-50' : 'bg-white'}`}
                                                        >
                                                            <div className="flex-1 px-3 py-2 min-w-0">
                                                                <div className="flex flex-col gap-0.5">
                                                                    {players && players.length > 0 ? players.map(p => (
                                                                        <div key={p.player_id} className={`truncate text-xs ${isWinner ? 'text-green-900 font-medium' : 'text-gray-900'}`}>
                                                                            {p.name} <span className="text-[10px] opacity-60">({(p.adjusted_skill_level || p.declared_skill_level).toFixed(2)})</span>
                                                                        </div>
                                                                    )) : (
                                                                        <span className="text-xs text-gray-500">
                                                                            {regularPlayers && regularPlayers.length > 0 ? `${regularPlayers.length} players` : `Team ${teamNum}`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {isWinner && (
                                                                <div className="pr-2">
                                                                    <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            {sets.length > 0 ? sets.map((set, i) => {
                                                                const score = set[teamNum - 1]
                                                                const otherScore = set[teamNum === 1 ? 1 : 0]
                                                                const setWon = parseInt(score) > parseInt(otherScore)

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className={`w-8 text-center py-2 flex-shrink-0 border-l ${isWinner ? 'border-green-100' : 'border-gray-50'} ${setWon ? 'font-bold text-gray-900 underline decoration-green-500 decoration-2 underline-offset-4' : 'text-gray-500'}`}
                                                                    >
                                                                        {score}
                                                                    </div>
                                                                )
                                                            }) : (
                                                                <div className="w-8 text-center py-2 text-gray-300">-</div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )

                                        return (
                                            <tr
                                                key={match.match_id}
                                                onClick={() => handleMatchClick(match.match_id)}
                                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatMatchTime(match.scheduled_time, match.clubs?.timezone || userClubTimezone || undefined)}
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
                                                    <div className="flex flex-col">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${match.court_booked ? 'bg-indigo-100 text-indigo-800' : 'bg-red-50 text-red-700'
                                                            }`}>
                                                            {match.court_booked ? 'Booked' : 'Not Booked'}
                                                        </span>
                                                        {match.court_booked && match.booked_court_text && (
                                                            <span className="text-[10px] text-gray-500 mt-1 ml-1 font-medium">
                                                                {match.booked_court_text}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 align-top w-1/3 min-w-[300px]" colSpan={2}>
                                                    {match.score_text ? renderScorecard() : (
                                                        <div className="space-y-1">
                                                            <div className="text-xs text-gray-900">
                                                                {match.team_1_details?.map(p => p.name).join(' / ') || 'Team 1'}
                                                            </div>
                                                            <div className="text-xs text-gray-900">
                                                                {match.team_2_details?.map(p => p.name).join(' / ') || 'Team 2'}
                                                            </div>
                                                        </div>
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
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
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
