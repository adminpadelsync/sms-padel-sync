'use client'

import { useState, useEffect } from 'react'
import { LogoutButton } from './logout-button'
import { PlayerActions, PlayerModal } from './player-management'
import { CreatePlayerButton } from './create-player-button'
import { CreateMatchButton } from './create-match-button'
import { ClubSelector } from './club-selector'
import { MatchDetailsModal } from './match-details-modal'
import { MatchWizard } from './create-match-wizard'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    active_status: boolean
    club_id: string
    clubs?: {
        name: string
    }
}

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    gender: string
}

interface Match {
    match_id: string
    scheduled_time: string
    status: string
    team_1_players: string[]
    team_2_players: string[]
    team_1_player_details?: Player[]
    team_2_player_details?: Player[]
    club_id: string
    clubs?: {
        name: string
    }
}

interface DashboardClientProps {
    initialPlayers: Player[]
    initialMatches: Match[]
    userEmail: string
    isSuperuser: boolean
    userClubId: string | null
    clubs: { club_id: string; name: string }[]
}

export function DashboardClient({
    initialPlayers,
    initialMatches,
    userEmail,
    isSuperuser,
    userClubId,
    clubs
}: DashboardClientProps) {
    const [mounted, setMounted] = useState(false)
    const [selectedClubId, setSelectedClubId] = useState<string>(() => {
        // On server, use userClubId or first club
        if (isSuperuser) {
            return userClubId || clubs[0]?.club_id || ''
        }
        return userClubId || ''
    })
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
    const [matchModalOpen, setMatchModalOpen] = useState(false)

    // Player filter state
    const [targetLevel, setTargetLevel] = useState<number | null>(null)
    const [levelRange, setLevelRange] = useState<number>(0.5)
    const [genderFilter, setGenderFilter] = useState<string>('all')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // Search and Selection state
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
    const [isMatchWizardOpen, setIsMatchWizardOpen] = useState(false)
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

    // Filter data by selected club
    let filteredPlayers = isSuperuser && mounted
        ? initialPlayers.filter(p => p.club_id === selectedClubId)
        : isSuperuser
            ? initialPlayers.filter(p => p.club_id === (userClubId || clubs[0]?.club_id))
            : initialPlayers

    // Apply skill level filter
    if (targetLevel !== null) {
        const minLevel = targetLevel - levelRange
        const maxLevel = targetLevel + levelRange
        filteredPlayers = filteredPlayers.filter(p =>
            p.declared_skill_level >= minLevel && p.declared_skill_level <= maxLevel
        )
    }

    // Apply gender filter
    if (genderFilter !== 'all') {
        filteredPlayers = filteredPlayers.filter(p =>
            p.gender?.toLowerCase() === genderFilter.toLowerCase()
        )
    }

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filteredPlayers = filteredPlayers.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.phone_number.includes(query)
        )
    }

    // Sort by name (alphabetically)
    filteredPlayers = filteredPlayers.sort((a, b) => a.name.localeCompare(b.name))

    // Reset page when filters change
    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1)
        setSelectedPlayerIds(new Set()) // Clear selection on filter change
    }, [targetLevel, genderFilter, selectedClubId, searchQuery])

    // Calculate pagination
    const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentPlayers = filteredPlayers.slice(startIndex, endIndex)

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

    // Calculate summary stats
    const activePlayers = filteredPlayers.filter(p => p.active_status).length
    const upcomingMatches = filteredMatches.filter(m => m.status === 'confirmed' && new Date(m.scheduled_time) > new Date()).length
    const votingMatches = filteredMatches.filter(m => m.status === 'voting').length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const completedToday = filteredMatches.filter(m => {
        const matchDate = new Date(m.scheduled_time)
        matchDate.setHours(0, 0, 0, 0)
        return matchDate.getTime() === today.getTime() && m.status === 'completed'
    }).length

    const handleMatchClick = (matchId: string) => {
        // Navigate to the match detail page
        window.location.href = `/dashboard/matches/${matchId}`
    }

    const handleMatchUpdate = async () => {
        // Refetch the match data without closing the modal
        if (selectedMatch) {
            try {
                const response = await fetch(`/api/matches/${selectedMatch.match_id}`)
                if (!response.ok) throw new Error('Failed to fetch match details')
                const data = await response.json()
                setSelectedMatch(data.match)
            } catch (error) {
                console.error('Error refreshing match details:', error)
            }
        }
    }

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Select all active players on the current page
            const newSelected = new Set(selectedPlayerIds)
            currentPlayers.forEach(p => newSelected.add(p.player_id))
            setSelectedPlayerIds(newSelected)
        } else {
            // Deselect all active players on the current page
            const newSelected = new Set(selectedPlayerIds)
            currentPlayers.forEach(p => newSelected.delete(p.player_id))
            setSelectedPlayerIds(newSelected)
        }
    }

    const handleSelectRow = (playerId: string) => {
        const newSelected = new Set(selectedPlayerIds)
        if (newSelected.has(playerId)) {
            newSelected.delete(playerId)
        } else {
            newSelected.add(playerId)
        }
        setSelectedPlayerIds(newSelected)
    }

    const getSelectedPlayersData = () => {
        return initialPlayers.filter(p => selectedPlayerIds.has(p.player_id))
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="mt-1 text-sm text-gray-500">Welcome back, {userEmail}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a
                            href="/sms-simulator"
                            className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                            📱 SMS Simulator
                        </a>
                        {isSuperuser && clubs.length > 0 && (
                            <ClubSelector
                                clubs={clubs}
                                defaultClubId={userClubId}
                                onClubChange={setSelectedClubId}
                            />
                        )}
                        <LogoutButton />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                        <div className="px-6 py-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">👥</span>
                                </div>
                                <div className="ml-5 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Active Players</dt>
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{activePlayers}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                        <div className="px-6 py-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">📅</span>
                                </div>
                                <div className="ml-5 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Upcoming Matches</dt>
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{upcomingMatches}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                        <div className="px-6 py-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">🗳️</span>
                                </div>
                                <div className="ml-5 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Voting Matches</dt>
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{votingMatches}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                        <div className="px-6 py-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">✅</span>
                                </div>
                                <div className="ml-5 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Completed Today</dt>
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{completedToday}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Players Section */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 mb-8">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-medium text-gray-900">Players</h2>
                        <CreatePlayerButton clubId={selectedClubId} />
                    </div>

                    {/* Filter Controls */}
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-sm font-medium text-gray-700 block mb-1">Search</label>
                                <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Skill Level:</label>
                                <select
                                    value={targetLevel || ''}
                                    onChange={(e) => setTargetLevel(e.target.value ? parseFloat(e.target.value) : null)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">All Levels</option>
                                    <option value="2.0">2.0</option>
                                    <option value="2.5">2.5</option>
                                    <option value="3.0">3.0</option>
                                    <option value="3.5">3.5</option>
                                    <option value="4.0">4.0</option>
                                    <option value="4.5">4.5</option>
                                    <option value="5.0">5.0</option>
                                </select>
                                {targetLevel !== null && (
                                    <>
                                        <span className="text-sm text-gray-500 -ml-1">±</span>
                                        <select
                                            value={levelRange}
                                            onChange={(e) => setLevelRange(parseFloat(e.target.value))}
                                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 -ml-1"
                                        >
                                            <option value="0.25">0.25</option>
                                            <option value="0.5">0.5</option>
                                            <option value="0.75">0.75</option>
                                            <option value="1.0">1.0</option>
                                        </select>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Gender:</label>
                                <select
                                    value={genderFilter}
                                    onChange={(e) => setGenderFilter(e.target.value)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">All</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>

                            {(targetLevel !== null || genderFilter !== 'all' || searchQuery) && (
                                <button
                                    onClick={() => {
                                        setTargetLevel(null)
                                        setLevelRange(0.5)
                                        setGenderFilter('all')
                                        setSearchQuery('')
                                    }}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Clear Filters
                                </button>
                            )}

                            <div className="ml-auto flex items-center gap-4">
                                {selectedPlayerIds.size > 0 && (
                                    <button
                                        onClick={() => setIsMatchWizardOpen(true)}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                    >
                                        Create Match ({selectedPlayerIds.size})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            checked={currentPlayers.length > 0 && currentPlayers.every(p => selectedPlayerIds.has(p.player_id))}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                    {isSuperuser && (
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Club</th>
                                    )}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentPlayers && currentPlayers.length > 0 ? (
                                    currentPlayers.map((player) => (
                                        <tr key={player.player_id} className={selectedPlayerIds.has(player.player_id) ? 'bg-indigo-50' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    checked={selectedPlayerIds.has(player.player_id)}
                                                    onChange={() => handleSelectRow(player.player_id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.phone_number}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.declared_skill_level}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{player.gender || 'N/A'}</td>
                                            {isSuperuser && (
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {player.clubs?.name || 'Unknown'}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${player.active_status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {player.active_status ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <PlayerActions player={player} />
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={isSuperuser ? 7 : 6} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No players found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <p className="text-sm text-gray-700">
                                        Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredPlayers.length)}</span> of{' '}
                                        <span className="font-medium">{filteredPlayers.length}</span> results
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-700">Rows:</span>
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => {
                                                setItemsPerPage(Number(e.target.value))
                                                setCurrentPage(1)
                                            }}
                                            className="block w-full pl-3 pr-8 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">First</span>
                                            «
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Previous</span>
                                            ‹
                                        </button>

                                        {/* Page Numbers */}
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum = currentPage;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            // Ensure valid pageNum
                                            if (pageNum > totalPages || pageNum < 1) return null;

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNum
                                                        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Next</span>
                                            ›
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Last</span>
                                            »
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Matches Section */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-medium text-gray-900">Matches</h2>
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
                        <CreateMatchButton clubId={selectedClubId} />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                                    {isSuperuser && (
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Club</th>
                                    )}
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
                                                {new Date(match.scheduled_time).toLocaleString()}
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
                                            {isSuperuser && (
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {match.clubs?.name || 'Unknown'}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={isSuperuser ? 4 : 3} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No matches found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Match Details Modal */}
            <MatchDetailsModal
                match={selectedMatch}
                isOpen={matchModalOpen}
                onClose={() => setMatchModalOpen(false)}
                onUpdate={handleMatchUpdate}
            />

            {/* Create Match Wizard (from selection) */}
            <MatchWizard
                isOpen={isMatchWizardOpen}
                onClose={() => setIsMatchWizardOpen(false)}
                clubId={selectedClubId}
                initialSelectedPlayers={getSelectedPlayersData()}
            />
        </div>
    )
}
