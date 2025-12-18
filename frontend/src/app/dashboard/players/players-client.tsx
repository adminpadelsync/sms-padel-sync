'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlayerActions, PlayerModal } from '../player-management'
import { CreatePlayerButton } from '../create-player-button'
import { MatchWizard } from '../create-match-wizard'
import { SwitchClubModal } from '../switch-club-modal'
import { AddToGroupModal } from '../groups/add-to-group-modal'
import { GroupModal } from '../groups/group-modal'
import { VerificationModal } from '../verification-modal'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Groups</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {player.declared_skill_level.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex flex-col gap-1.5 w-32">
                                                <div className="flex items-center gap-2" title="Responsiveness Score (Response Rate)">
                                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 w-8">Resp</span>
                                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${(!player.responsiveness_score || player.responsiveness_score < 50) ? 'bg-red-400' : player.responsiveness_score < 80 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                                                            style={{ width: `${player.responsiveness_score || 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600 w-6 text-right">{player.responsiveness_score || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2" title="Reputation Score (Based on No-shows)">
                                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 w-8">Rep</span>
                                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${(!player.reputation_score || player.reputation_score < 50) ? 'bg-red-400' : player.reputation_score < 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                                                            style={{ width: `${player.reputation_score || 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600 w-6 text-right">{player.reputation_score || '-'}</span>
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
                                                onVerify={() => {
                                                    setPlayerToVerify(player)
                                                    setVerificationModalOpen(true)
                                                }}
                                            />
                                        </td>
                                    </tr>
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
        </div>
    )
}
