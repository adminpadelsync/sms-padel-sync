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
}

interface MatchesClientProps {
    initialMatches: Match[]
    isSuperuser: boolean
    userClubId: string | null
    clubs: { club_id: string; name: string }[]
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

export function MatchesClient({
    initialMatches,
    isSuperuser,
    userClubId,
    clubs
}: MatchesClientProps) {
    const [mounted, setMounted] = useState(false)
    const [selectedClubId, setSelectedClubId] = useState<string>(() => {
        if (isSuperuser) {
            return userClubId || clubs[0]?.club_id || ''
        }
        return userClubId || ''
    })
    const [showCompletedMatches, setShowCompletedMatches] = useState(false)

    // After mount, check localStorage for saved club selection
    useEffect(() => {
        setMounted(true)
        if (isSuperuser && typeof window !== 'undefined') {
            const stored = localStorage.getItem('selectedClubId')
            if (stored && clubs.find(c => c.club_id === stored)) {
                setSelectedClubId(stored)
            }
        }
    }, [isSuperuser, clubs])

    // Filter matches by selected club
    let filteredMatches = isSuperuser && mounted
        ? initialMatches.filter(m => m.club_id === selectedClubId)
        : isSuperuser
            ? initialMatches.filter(m => m.club_id === (userClubId || clubs[0]?.club_id))
            : initialMatches

    // Filter out completed/cancelled AND past matches unless checkbox is checked
    if (!showCompletedMatches) {
        const now = new Date()
        filteredMatches = filteredMatches.filter(m =>
            m.status !== 'completed' &&
            m.status !== 'cancelled' &&
            new Date(m.scheduled_time) > now
        )
    }

    // Sort by scheduled time (upcoming first)
    filteredMatches = filteredMatches.sort((a, b) =>
        new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
    )

    const handleMatchClick = (matchId: string) => {
        window.location.href = `/dashboard/matches/${matchId}`
    }

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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {match.team_1_players.length + match.team_2_players.length} / 4
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
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
