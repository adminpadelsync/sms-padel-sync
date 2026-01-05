'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CreateMatchButton } from '../create-match-button'
import { formatLocalizedTime } from '@/utils/time-utils'
import {
    Calendar,
    Search,
    Filter,
    ChevronRight,
    Plus,
    Clock,
    User,
    Users,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
    List as ListIcon
} from 'lucide-react'

interface PlayerDetail {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
}

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

interface MatchesClientProps {
    initialMatches: Match[]
    userClubId: string | null
    userId: string
    userClubTimezone?: string | null
}

// Format date with day of week in a specific timezone: "Mon, Dec 16, 4:00 PM"
function formatMatchTime(dateString: string, timeZone?: string): string {
    return formatLocalizedTime(dateString, timeZone)
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

export function MatchesClient({ initialMatches, userClubId, userId, userClubTimezone }: MatchesClientProps) {
    const router = useRouter()
    const [matches, setMatches] = useState<Match[]>(initialMatches)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showOlderMatches, setShowOlderMatches] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [markingBookedId, setMarkingBookedId] = useState<string | null>(null)

    // Update matches if initialMatches change
    useEffect(() => {
        setMatches(initialMatches)
    }, [initialMatches])

    const filteredMatches = useMemo(() => {
        let result = [...matches]

        // Club filter
        if (userClubId) {
            result = result.filter(m => m.club_id === userClubId)
        }

        // Status filter
        if (filterStatus !== 'all') {
            result = result.filter(m => m.status === filterStatus)
        }

        // Search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(m =>
                m.match_id.toLowerCase().includes(query) ||
                (m.player_names || []).some(name => name.toLowerCase().includes(query))
            )
        }

        // Older matches filter
        if (!showOlderMatches) {
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            yesterday.setHours(0, 0, 0, 0)

            result = result.filter(m =>
                new Date(m.scheduled_time) >= yesterday
            )
        }

        // Sort by date (descending)
        return result.sort((a, b) =>
            new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime()
        )
    }, [matches, filterStatus, searchQuery, showOlderMatches])

    const bookingNeededMatches = useMemo(() => {
        const now = new Date()
        return matches.filter(m =>
            !m.court_booked &&
            (m.status === 'confirmed' || m.status === 'pending') &&
            new Date(m.scheduled_time) > now &&
            (userClubId ? m.club_id === userClubId : true)
        ).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    }, [matches, userClubId])

    const toggleRow = (matchId: string) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(matchId)) {
            newExpanded.delete(matchId)
        } else {
            newExpanded.add(matchId)
        }
        setExpandedRows(newExpanded)
    }

    const toggleMatchSelection = (matchId: string) => {
        const newSelected = new Set(selectedMatchIds)
        if (newSelected.has(matchId)) {
            newSelected.delete(matchId)
        } else {
            newSelected.add(matchId)
        }
        setSelectedMatchIds(newSelected)
    }

    const toggleAllSelection = () => {
        if (selectedMatchIds.size === filteredMatches.length) {
            setSelectedMatchIds(new Set())
        } else {
            setSelectedMatchIds(new Set(filteredMatches.map(m => m.match_id)))
        }
    }

    const handleBulkDelete = async () => {
        if (selectedMatchIds.size === 0 || !confirm(`Are you sure you want to delete ${selectedMatchIds.size} matches?`)) return

        setIsDeleting(true)
        try {
            const res = await fetch('/api/admin/matches/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_ids: Array.from(selectedMatchIds) })
            })

            if (!res.ok) throw new Error('Failed to delete matches')

            setMatches(prev => prev.filter(m => !selectedMatchIds.has(m.match_id)))
            setSelectedMatchIds(new Set())
        } catch (err) {
            console.error('Error deleting matches:', err)
            alert('Failed to delete matches')
        } finally {
            setIsDeleting(false)
        }
    }

    const handleMarkAsBooked = async (e: React.MouseEvent, matchId: string) => {
        e.stopPropagation()
        const courtText = prompt("Optional: Which court did you book? (e.g. 'Court 1')")
        if (courtText === null) return // Cancelled prompt

        setMarkingBookedId(matchId)
        try {
            const res = await fetch(`/api/matches/${matchId}/mark-booked`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    court_text: courtText || undefined
                })
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.detail || 'Failed to mark as booked')
            }

            // Update local state
            setMatches(prev => prev.map(m =>
                m.match_id === matchId ? {
                    ...m,
                    court_booked: true,
                    booked_court_text: courtText || m.booked_court_text
                } : m
            ))
        } catch (err: any) {
            console.error('Error marking as booked:', err)
            alert(`Error: ${err.message || 'Could not mark match as booked'}`)
        } finally {
            setMarkingBookedId(null)
        }
    }

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'completed':
                return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'cancelled':
                return 'bg-red-100 text-red-800 border-red-200'
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const upcomingMatches = filteredMatches.filter(m =>
        new Date(m.scheduled_time) > new Date()
    ).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Matches</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and track your padel games</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Table View"
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                    {userClubId && <CreateMatchButton clubId={userClubId} clubTimezone={userClubTimezone} />}
                </div>
            </div>

            {/* Court Booking To-Do List (Only for unbooked future matches) */}
            {bookingNeededMatches.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Court Booking Requirements</h2>
                        <span className="bg-red-50 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full border border-red-100 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {bookingNeededMatches.length} Pending
                        </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {bookingNeededMatches.map(match => (
                            <div
                                key={match.match_id}
                                className="bg-white p-5 rounded-2xl border-l-[6px] border-l-red-500 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                                onClick={() => router.push(`/dashboard/matches/${match.match_id}`)}
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-5 h-5 text-gray-300" />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-indigo-600 tracking-wide uppercase">
                                            {formatMatchTime(match.scheduled_time, match.clubs?.timezone || userClubTimezone || undefined)}
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getStatusStyles(match.status)}`}>
                                                {match.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleMarkAsBooked(e, match.match_id)}
                                        disabled={markingBookedId === match.match_id}
                                        className="inline-flex items-center justify-center h-8 px-3.5 bg-green-600 hover:bg-green-700 text-white text-xs font-black rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {markingBookedId === match.match_id ? (
                                            <div className="flex items-center gap-1">
                                                <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                ...
                                            </div>
                                        ) : (
                                            'MARK BOOKED'
                                        )}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Originator Callout */}
                                    {match.originator && (
                                        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 group-hover:bg-indigo-50 transition-colors">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <User className="w-3 h-3 text-indigo-500" />
                                                <p className="text-[10px] uppercase font-black text-indigo-600 tracking-wider">Host/Originator</p>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className="text-xs font-bold text-gray-900 truncate mr-2">{match.originator.name}</p>
                                                <p className="text-[10px] text-indigo-700 font-mono tracking-tighter bg-white px-1.5 py-0.5 rounded border border-indigo-100/50 shrink-0">
                                                    {formatPhoneNumber(match.originator.phone_number)}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Player List */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {Array.from({ length: 4 }).map((_, i) => {
                                            const allPlayers = [...(match.team_1_details || []), ...(match.team_2_details || [])]
                                            const p = allPlayers[i]
                                            return (
                                                <div key={i} className={`p-2 rounded-xl border transition-all ${p ? 'bg-gray-50 border-gray-100 group-hover:bg-white' : 'bg-gray-50/30 border-dashed border-gray-200'}`}>
                                                    {p ? (
                                                        <>
                                                            <p className="text-[11px] font-bold text-gray-900 truncate">{p.name || 'Anonymous'}</p>
                                                            <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-500">
                                                                <span className="bg-gray-200/50 px-1 rounded font-bold">Lvl {p.declared_skill_level || '-'}</span>
                                                                <span className="font-mono tracking-tighter truncate">{formatPhoneNumber(p.phone_number || '').replace(/^\+1/, '')}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center py-1">
                                                            <Plus className="w-3 h-3 text-gray-300" />
                                                            <span className="text-[9px] text-gray-400 font-medium ml-1">Open</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search players or match ID..."
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <select
                            className="block w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer shadow-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showOlderMatches}
                                    onChange={(e) => setShowOlderMatches(e.target.checked)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                Show matches prior to yesterday
                            </label>

                            {selectedMatchIds.size > 0 && (
                                <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                                    <span className="text-sm font-medium text-gray-700">
                                        {selectedMatchIds.size} selected
                                    </span>
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={isDeleting}
                                        className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {isDeleting ? (
                                            <>
                                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete Selected
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedMatchIds.size > 0 && selectedMatchIds.size === filteredMatches.length}
                                            onChange={toggleAllSelection}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Players</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredMatches.length > 0 ? (
                                    filteredMatches.map((match) => {
                                        const isExpanded = expandedRows.has(match.match_id)
                                        const isSelected = selectedMatchIds.has(match.match_id)

                                        return (
                                            <tr
                                                key={match.match_id}
                                                onClick={() => router.push(`/dashboard/matches/${match.match_id}`)}
                                                className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                            >
                                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleMatchSelection(match.match_id)}
                                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {formatMatchTime(match.scheduled_time, match.clubs?.timezone || userClubTimezone || undefined)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-semibold rounded-full border ${getStatusStyles(match.status)}`}>
                                                            {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-0.5 ml-0.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${match.court_booked ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                                            <span className={`text-[10px] font-black tracking-tight ${match.court_booked ? 'text-gray-500' : 'text-red-500'}`}>
                                                                {match.court_booked ? (match.booked_court_text || 'BOOKED').toUpperCase() : 'NEEDS COURT'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 max-w-[200px]">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(match.player_names || []).map((name, i) => (
                                                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                                {name}
                                                            </span>
                                                        ))}
                                                        {(match.player_names || []).length === 0 && <span className="text-sm text-gray-400">No players yet</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {match.score_text || <span className="text-gray-300 italic">No score yet</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <a
                                                            href={`/dashboard/matches/${match.match_id}`}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group"
                                                            title="View details"
                                                        >
                                                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                                                        </a>
                                                        <button
                                                            onClick={() => toggleRow(match.match_id)}
                                                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                        >
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                    </div>
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
