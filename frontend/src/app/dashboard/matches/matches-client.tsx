'use client'

import { useState, useEffect, useMemo } from 'react'
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
    const [matches, setMatches] = useState<Match[]>(initialMatches)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showOlderMatches, setShowOlderMatches] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    // Update matches if initialMatches change
    useEffect(() => {
        setMatches(initialMatches)
    }, [initialMatches])

    const filteredMatches = useMemo(() => {
        let result = [...matches]

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
                                            <tr key={match.match_id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-6 py-4">
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
                                                        <span className="text-[10px] text-gray-400 font-mono mt-0.5">{match.match_id.slice(0, 8)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-semibold rounded-full border ${getStatusStyles(match.status)}`}>
                                                        {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                                                    </span>
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
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
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
