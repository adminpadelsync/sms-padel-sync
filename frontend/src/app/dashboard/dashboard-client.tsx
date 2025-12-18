'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SwitchClubModal } from './switch-club-modal'
import { AnalyticsDashboard } from './analytics/analytics-dashboard'

interface Player {
    player_id: string
    active_status: boolean
    club_id: string
}

interface Match {
    match_id: string
    scheduled_time: string
    status: string
    club_id: string
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
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [selectedClubId, setSelectedClubId] = useState<string>(() => {
        if (isSuperuser) {
            return userClubId || clubs[0]?.club_id || ''
        }
        return userClubId || ''
    })
    const [switchClubModalOpen, setSwitchClubModalOpen] = useState(false)
    const [openInvites, setOpenInvites] = useState(0)

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
    const clubPlayers = initialPlayers.filter(p => p.club_id === selectedClubId)
    const clubMatches = initialMatches.filter(m => m.club_id === selectedClubId)

    // Calculate summary stats
    const activePlayersCount = clubPlayers.filter(p => p.active_status).length
    const now = new Date()
    const upcomingMatchesCount = clubMatches.filter(m => m.status === 'confirmed' && new Date(m.scheduled_time) > now).length
    const pendingMatchesCount = clubMatches.filter(m => m.status === 'pending' && new Date(m.scheduled_time) > now).length

    useEffect(() => {
        async function fetchOpenInvites() {
            try {
                const pendingMatchIds = clubMatches
                    .filter(m => m.status === 'pending' && new Date(m.scheduled_time) > new Date())
                    .map(m => m.match_id)

                if (pendingMatchIds.length === 0) {
                    setOpenInvites(0)
                    return
                }

                let totalOpen = 0
                for (const matchId of pendingMatchIds) {
                    const res = await fetch(`/api/matches/${matchId}/invites`)
                    if (res.ok) {
                        const data = await res.json()
                        totalOpen += (data.invites || []).filter((i: { status: string }) => i.status === 'sent').length
                    }
                }
                setOpenInvites(totalOpen)
            } catch (error) {
                console.error('Error fetching open invites:', error)
            }
        }

        if (mounted) {
            fetchOpenInvites()
        }
    }, [clubMatches, mounted])

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
                        {isSuperuser && (
                            <a
                                href="/dashboard/clubs/new"
                                className="px-4 py-2 text-sm font-medium text-green-600 hover:text-green-800 border border-green-600 rounded-md hover:bg-green-50 transition-colors"
                            >
                                ➕ Create Club
                            </a>
                        )}
                        {isSuperuser && (
                            <>
                                <button
                                    onClick={() => setSwitchClubModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                                >
                                    <span>🏢</span>
                                    <span>{clubs.find(c => c.club_id === selectedClubId)?.name || 'Select Club'}</span>
                                    <span className="text-xs text-gray-500 ml-1">(Switch)</span>
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
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{activePlayersCount}</dd>
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
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{upcomingMatchesCount}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                        <div className="px-6 py-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">⏳</span>
                                </div>
                                <div className="ml-5 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Pending Matches</dt>
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{pendingMatchesCount}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                        <div className="px-6 py-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">📩</span>
                                </div>
                                <div className="ml-5 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Open Invites</dt>
                                        <dd className="mt-1 text-2xl font-semibold text-gray-900">{openInvites}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytics Dashboard */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Analytics Overview</h2>
                    <AnalyticsDashboard clubId={selectedClubId} />
                </div>
            </div>
        </div>
    )
}
