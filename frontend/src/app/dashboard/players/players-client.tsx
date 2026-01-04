'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlayerActions, PlayerModal } from '../player-management'
import { CreatePlayerButton } from '../create-player-button'
import { MatchWizard } from '../create-match-wizard'
import { SwitchClubModal } from '../switch-club-modal'
import { AddToGroupModal } from '../groups/add-to-group-modal'
import { GroupModal } from '../groups/group-modal'
import { VerificationModal } from '../verification-modal'
import { MatchDetailsModal } from '../match-details-modal'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
    active_status: boolean
    club_id: string
    avail_weekday_morning?: boolean
    avail_weekday_afternoon?: boolean
    avail_weekday_evening?: boolean
    avail_weekend_morning?: boolean
    avail_weekend_afternoon?: boolean
    avail_weekend_evening?: boolean
    gender?: string
    pro_verified?: boolean
    pro_verified_at?: string
    pro_verification_notes?: string
    responsiveness_score?: number
    reputation_score?: number
    clubs?: {
        name: string
    }
    total_matches_played?: number
    groups?: {
        group_id: string
        name: string
    }[]
}

// Format phone number as (XXX) XXX-XXXX
function formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    const nationalNumber = digits.length === 11 && digits.startsWith('1')
        ? digits.slice(1)
        : digits
    if (nationalNumber.length !== 10) {
        return phone
    }
    return `(${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`
}

interface PlayersClientProps {
    initialPlayers: Player[]
    isSuperuser: boolean
    userClubId: string | null
    clubs: { club_id: string; name: string }[]
}

export function PlayersClient({
    initialPlayers,
    isSuperuser,
    userClubId,
    clubs
}: PlayersClientProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [selectedClubId, setSelectedClubId] = useState<string>(() => {
        if (isSuperuser) {
            return userClubId || clubs[0]?.club_id || ''
        }
        return userClubId || ''
    })
    const [switchClubModalOpen, setSwitchClubModalOpen] = useState(false)
    const [verificationModalOpen, setVerificationModalOpen] = useState(false)
    const [playerToVerify, setPlayerToVerify] = useState<Player | null>(null)

    useEffect(() => {
        setMounted(true)
        if (isSuperuser && typeof window !== 'undefined') {
            const stored = localStorage.getItem('selectedClubId')
            if (stored && clubs.find(c => c.club_id === stored)) {
                setSelectedClubId(stored)
            }
        }
    }, [isSuperuser, clubs])
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
    const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false)
    const [addToGroupModalOpen, setAddToGroupModalOpen] = useState(false)
    const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
    const [ratingHistory, setRatingHistory] = useState<Record<string, any[]>>({})
    const [loadingHistory, setLoadingHistory] = useState<string | null>(null)
    const [feedbackSummaries, setFeedbackSummaries] = useState<Record<string, any>>({})
    const [selectedMatch, setSelectedMatch] = useState<any | null>(null)
    const [isMatchDetailsOpen, setIsMatchDetailsOpen] = useState(false)

    const fetchRatingHistory = async (playerId: string) => {
        if (ratingHistory[playerId]) return
        setLoadingHistory(playerId)
        try {
            const res = await fetch(`/api/players/${playerId}/rating-history`)
            const data = await res.json()
            setRatingHistory(prev => ({ ...prev, [playerId]: data.history || [] }))
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setLoadingHistory(null)
        }
    }

    const fetchFeedbackSummary = async (playerId: string) => {
        if (feedbackSummaries[playerId]) return
        try {
            const res = await fetch(`/api/players/${playerId}/feedback-summary`)
            const data = await res.json()
            setFeedbackSummaries(prev => ({ ...prev, [playerId]: data }))
        } catch (error) {
            console.error('Error fetching feedback summary:', error)
        }
    }

    const openMatchDetails = async (matchId: string) => {
        try {
            const res = await fetch(`/api/matches/${matchId}`)
            const data = await res.json()
            setSelectedMatch(data.match)
            setIsMatchDetailsOpen(true)
        } catch (error) {
            console.error('Error fetching match details:', error)
        }
    }

    const toggleExpand = (playerId: string) => {
        if (expandedPlayerId === playerId) {
            setExpandedPlayerId(null)
        } else {
            setExpandedPlayerId(playerId)
            fetchRatingHistory(playerId)
            fetchFeedbackSummary(playerId)
        }
    }

    useEffect(() => {
        setMounted(true)
    }, [])

    // Filter data by selected club
    let filteredPlayers = isSuperuser && mounted
        ? initialPlayers.filter(p => p.club_id === selectedClubId)
        : isSuperuser
            ? initialPlayers.filter(p => p.club_id === userClubId)
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
        if (genderFilter === 'verified') {
            filteredPlayers = filteredPlayers.filter(p => p.pro_verified)
        } else {
            filteredPlayers = filteredPlayers.filter(p =>
                p.gender?.toLowerCase() === genderFilter.toLowerCase()
            )
        }
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
    useEffect(() => {
        setCurrentPage(1)
        setSelectedPlayerIds(new Set())
    }, [targetLevel, genderFilter, selectedClubId, searchQuery])

    // Calculate pagination
    const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentPlayers = filteredPlayers.slice(startIndex, endIndex)

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const newSelected = new Set(selectedPlayerIds)
            currentPlayers.forEach(p => newSelected.add(p.player_id))
            setSelectedPlayerIds(newSelected)
        } else {
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

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 mb-8">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-900">Players</h2>
                        {isSuperuser && (
                            <>
                                <button
                                    onClick={() => setSwitchClubModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                                >
                                    <span>🏢</span>
                                    <span>{clubs.find(c => c.club_id === selectedClubId)?.name || 'Select Club'}</span>
                                    <span className="text-gray-500">(Switch)</span>
                                </button>
                                <SwitchClubModal
                                    isOpen={switchClubModalOpen}
                                    onClose={() => setSwitchClubModalOpen(false)}
                                    clubs={clubs}
                                    currentClubId={selectedClubId}
                                />
                            </>
                        )}
                    </div>
                    <CreatePlayerButton clubId={selectedClubId} />
                </div>

                {/* Filter Controls */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="w-64">
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
                                <option value="verified">Verified Only</option>
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
                                <>
                                    <button
                                        onClick={() => setCreateGroupModalOpen(true)}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                    >
                                        Create Group
                                    </button>
                                    <button
                                        onClick={() => setAddToGroupModalOpen(true)}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                    >
                                        Add to Group
                                    </button>
                                    <button
                                        onClick={() => setIsMatchWizardOpen(true)}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                    >
                                        Create Match ({selectedPlayerIds.size})
                                    </button>
                                </>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Groups</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentPlayers && currentPlayers.length > 0 ? (
                                currentPlayers.map((player) => (
                                    <React.Fragment key={player.player_id}>
                                        <tr className={selectedPlayerIds.has(player.player_id) ? 'bg-indigo-50' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    checked={selectedPlayerIds.has(player.player_id)}
                                                    onChange={() => handleSelectRow(player.player_id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                                                <div className="flex items-center gap-1">
                                                    {player.name}
                                                    {player.pro_verified && (
                                                        <span title="Verified Pro Level">
                                                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatPhoneNumber(player.phone_number)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => toggleExpand(player.player_id)}
                                                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 transition-colors w-fit group"
                                                    >
                                                        <span className={`font-mono font-medium ${player.pro_verified ? 'text-indigo-600' : 'text-gray-700'}`}>
                                                            {(player.adjusted_skill_level || player.declared_skill_level).toFixed(2)}
                                                        </span>
                                                        <svg
                                                            className={`w-4 h-4 text-gray-400 transition-transform ${expandedPlayerId === player.player_id ? 'rotate-180' : ''}`}
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                    <div className="flex flex-col pl-2">
                                                        <span className="text-[9px] uppercase font-bold text-gray-400">
                                                            STATED: {player.declared_skill_level.toFixed(2)}
                                                        </span>
                                                        {!player.pro_verified ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setPlayerToVerify(player)
                                                                    setVerificationModalOpen(true)
                                                                }}
                                                                className="text-[10px] uppercase font-bold text-indigo-500 hover:text-indigo-700 mt-1 text-left"
                                                            >
                                                                Verify Level
                                                            </button>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-600 mt-1">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                                Pro Verified
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex flex-col gap-1.5 w-32">
                                                    <div className="flex items-center gap-2" title="Responsiveness (SMS Reply Rate)">
                                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 w-16">Resp</span>
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${(!player.responsiveness_score || player.responsiveness_score < 50) ? 'bg-red-400' : player.responsiveness_score < 80 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                                                                style={{ width: `${player.responsiveness_score || 0}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-600 w-6 text-right">{player.responsiveness_score || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2" title="Matches Played">
                                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 w-16">Matches</span>
                                                        <span className="text-xs font-bold text-indigo-600">{player.total_matches_played || 0}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{player.gender || 'N/A'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {player.groups && player.groups.length > 0 ? (
                                                    <ul className="list-disc pl-4 space-y-0.5">
                                                        {player.groups.map(group => (
                                                            <li key={group.group_id} className="text-gray-600">
                                                                {group.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${player.active_status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {player.active_status ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <PlayerActions
                                                    player={player}
                                                />
                                            </td>
                                        </tr>

                                        {/* Expandable History Row */}
                                        {expandedPlayerId === player.player_id && (
                                            <tr className="bg-gray-50/50">
                                                <td colSpan={9} className="px-6 py-4 border-t border-gray-100 shadow-inner">
                                                    <div className="max-w-4xl">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Feedback Insights</h4>
                                                            <button
                                                                onClick={() => setExpandedPlayerId(null)}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>

                                                        {/* Feedback Summary Cards */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Rating</p>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-2xl font-bold text-gray-900">{feedbackSummaries[player.player_id]?.avg_rating || '—'}</span>
                                                                    <span className="text-sm text-gray-400">/ 10</span>
                                                                </div>
                                                                <div className="mt-2 flex text-yellow-400">
                                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                                        <svg key={i} className={`w-4 h-4 ${i < Math.round((feedbackSummaries[player.player_id]?.avg_rating || 0) / 2) ? 'fill-current' : 'text-gray-200'}`} viewBox="0 0 20 20">
                                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                                        </svg>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Play Again Rate</p>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-2xl font-bold text-green-600">{feedbackSummaries[player.player_id]?.play_again_pct || 0}%</span>
                                                                    <span className="text-xs text-gray-400">would re-match</span>
                                                                </div>
                                                                <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                                                                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${feedbackSummaries[player.player_id]?.play_again_pct || 0}%` }} />
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Reviews</p>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-2xl font-bold text-gray-900">{feedbackSummaries[player.player_id]?.total_reviews || 0}</span>
                                                                    <span className="text-xs text-gray-400">submissions</span>
                                                                </div>
                                                                <p className="mt-2 text-[10px] text-gray-500 italic">Based on lifetime match feedback</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Rating History & Progression</h4>
                                                        </div>

                                                        {loadingHistory === player.player_id ? (
                                                            <div className="py-8 flex justify-center">
                                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                                                            </div>
                                                        ) : ratingHistory[player.player_id]?.length > 0 ? (
                                                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                                                <table className="min-w-full divide-y divide-gray-200">
                                                                    <thead className="bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                                                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Type</th>
                                                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Sync Rating</th>
                                                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Elo</th>
                                                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Notes</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {ratingHistory[player.player_id].map((entry) => {
                                                                            const isAway = entry.match_id && entry.matches?.club_id !== selectedClubId;
                                                                            return (
                                                                                <tr key={entry.history_id} className="hover:bg-gray-50 transition-colors">
                                                                                    <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                                                                                        {new Date(entry.matches?.scheduled_time || entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-xs">
                                                                                        <span
                                                                                            onClick={() => !isAway && entry.match_id && openMatchDetails(entry.match_id)}
                                                                                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-tighter ${entry.match_id && !isAway ? 'cursor-pointer hover:ring-1 hover:ring-offset-1 ring-blue-200' : ''} ${entry.change_type === 'match_result' ? (isAway ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700') :
                                                                                                entry.change_type === 'pro_verification' ? 'bg-green-50 text-green-700' :
                                                                                                    entry.change_type === 'assessment' ? 'bg-purple-50 text-purple-700' :
                                                                                                        'bg-gray-50 text-gray-700'
                                                                                                }`}>
                                                                                            {isAway ? 'Away Match' : entry.change_type.replace('_', ' ')}
                                                                                            {entry.match_id && !isAway && <span className="ml-1 opacity-50">🔍</span>}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-xs font-mono font-bold text-indigo-600">
                                                                                        {entry.new_sync_rating.toFixed(2)}
                                                                                        {entry.old_sync_rating && (
                                                                                            <span className="ml-1 text-[10px] font-normal text-gray-400">
                                                                                                (from {entry.old_sync_rating.toFixed(2)})
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                                                                                        {entry.new_elo_rating}
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-xs text-gray-500 italic truncate max-w-[200px]" title={entry.notes || entry.matches?.score_text}>
                                                                                        {isAway ? '—' : (entry.notes || entry.matches?.score_text || '—')}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 bg-gray-100/50 rounded-lg border-2 border-dashed border-gray-200">
                                                                <p className="text-xs text-gray-500 italic">No rating history found for this player.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
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
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredPlayers.length)}</span> of{' '}
                                    <span className="font-medium">{filteredPlayers.length}</span> results
                                </p>
                            </div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    ‹
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === i + 1
                                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    ›
                                </button>
                            </nav>
                        </div>
                    </div>
                )}
            </div>

            <GroupModal
                isOpen={createGroupModalOpen}
                onClose={() => setCreateGroupModalOpen(false)}
                initialMemberIds={Array.from(selectedPlayerIds)}
                mode="create"
                clubId={selectedClubId}
            />

            <AddToGroupModal
                isOpen={addToGroupModalOpen}
                onClose={() => setAddToGroupModalOpen(false)}
                playerIds={Array.from(selectedPlayerIds)}
                clubId={selectedClubId}
            />

            <MatchWizard
                isOpen={isMatchWizardOpen}
                onClose={() => setIsMatchWizardOpen(false)}
                clubId={selectedClubId || ''}
                initialSelectedPlayers={initialPlayers.filter(p => selectedPlayerIds.has(p.player_id))}
            />

            <VerificationModal
                isOpen={verificationModalOpen}
                onClose={() => {
                    setVerificationModalOpen(false)
                    setPlayerToVerify(null)
                }}
                player={playerToVerify}
            />

            <MatchDetailsModal
                isOpen={isMatchDetailsOpen}
                onClose={() => setIsMatchDetailsOpen(false)}
                match={selectedMatch}
                onUpdate={(updatedMatch) => {
                    if (updatedMatch) {
                        setSelectedMatch(updatedMatch)
                    } else {
                        setIsMatchDetailsOpen(false)
                    }
                }}
            />
        </div>
    )
}
