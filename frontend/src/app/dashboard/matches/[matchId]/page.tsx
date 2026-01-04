'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    ChevronDown,
    ChevronUp,
    Calendar,
    Users,
    Trophy,
    MessageSquare,
    Send,
    Edit2,
    XCircle,
    CheckCircle2,
    Clock,
    AlertCircle,
    RotateCcw,
    ArrowRightLeft
} from 'lucide-react'


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
    score_text?: string
    winner_team?: number
    feedback_collected?: boolean
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

    // For inline score editing
    const [isEditingResults, setIsEditingResults] = useState(false)
    const [setScores, setSetScores] = useState<string[][]>([['', ''], ['', ''], ['', '']])
    const [correctedWinner, setCorrectedWinner] = useState<number | undefined>(undefined)
    const [editTeam1Players, setEditTeam1Players] = useState<string[]>([])
    const [editTeam2Players, setEditTeam2Players] = useState<string[]>([])

    // For collapsible demographic section
    const [demoCollapsed, setDemoCollapsed] = useState<boolean | null>(null) // null means auto-determine

    // Nudge/Resend states
    const [resendingResult, setResendingResult] = useState(false)
    const [resendingFeedback, setResendingFeedback] = useState(false)

    const isPast = useMemo(() => {
        if (!match) return false
        return new Date(match.scheduled_time) < new Date()
    }, [match])

    // Effect to handle default collapse state
    useEffect(() => {
        if (match && demoCollapsed === null) {
            setDemoCollapsed(isPast)
        }
    }, [match, isPast, demoCollapsed])

    // Effect to sync result editing state
    useEffect(() => {
        // If we're already editing, don't let background refreshes overwrite our manual changes
        if (isEditingResults) return

        if (match) {
            setEditTeam1Players(match.team_1_players || [])
            setEditTeam2Players(match.team_2_players || [])

            if (match.score_text) {
                const parts = match.score_text.split(',').map(s => s.trim())
                const newScores = [['', ''], ['', ''], ['', '']]
                parts.forEach((part, i) => {
                    if (i < 3) {
                        const [s1, s2] = part.split('-')
                        newScores[i] = [s1 || '', s2 || '']
                    }
                })
                setSetScores(newScores)
                setCorrectedWinner(match.winner_team)
            }
        }
    }, [match, isEditingResults])


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

    const handleSwapPlayer = (playerId: string) => {
        if (editTeam1Players.includes(playerId)) {
            setEditTeam1Players(editTeam1Players.filter(id => id !== playerId))
            setEditTeam2Players([...editTeam2Players, playerId])
        } else {
            setEditTeam2Players(editTeam2Players.filter(id => id !== playerId))
            setEditTeam1Players([...editTeam1Players, playerId])
        }
    }

    const calculateWinnerFromScores = (scores: string[][]) => {
        let t1Sets = 0
        let t2Sets = 0
        scores.forEach(([s1, s2]) => {
            const n1 = parseInt(s1)
            const n2 = parseInt(s2)
            if (!isNaN(n1) && !isNaN(n2)) {
                if (n1 > n2) t1Sets++
                else if (n2 > n1) t2Sets++
            }
        })
        if (t1Sets > t2Sets) return 1
        if (t2Sets > t1Sets) return 2
        return undefined
    }

    const handleSaveResults = async () => {
        if (!match) return
        setActionLoading(true)
        try {
            const score_text = setScores
                .filter(s => s[0] !== '' || s[1] !== '')
                .map(s => `${s[0]}-${s[1]}`)
                .join(', ')

            const winner_team = calculateWinnerFromScores(setScores)

            const res = await fetch(`/api/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    score_text,
                    winner_team,
                    team_1_players: editTeam1Players,
                    team_2_players: editTeam2Players,
                    status: 'completed'
                })
            })
            if (res.ok) {
                const data = await res.json()
                setMatch(data.match)
                setIsEditingResults(false)
            }
        } catch (error) {
            console.error('Error saving results:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleResendResult = async () => {
        if (!match || resendingResult) return
        setResendingResult(true)
        try {
            const res = await fetch(`/api/matches/${matchId}/result-nudge`, {
                method: 'POST'
            })
            if (res.ok) {
                alert('Result request sent to the match organizer.')
            } else {
                const data = await res.json()
                alert(data.detail || 'Failed to resend result request.')
            }
        } catch (error) {
            console.error('Error resending result request:', error)
            alert('An error occurred while resending the request.')
        } finally {
            setResendingResult(false)
        }
    }

    const handleResendFeedback = async () => {
        if (!match || resendingFeedback) return
        setResendingFeedback(true)
        try {
            // Backend now handles skipping responders if we use the standard endpoint with force=true
            const res = await fetch(`/api/matches/${matchId}/feedback?force=true`, {
                method: 'POST'
            })
            if (res.ok) {
                const data = await res.json()
                alert(`Feedback requests resent to ${data.sms_sent} players (skipping those who already responded).`)
            } else {
                const data = await res.json()
                alert(data.detail || 'Failed to resend feedback requests.')
            }
        } catch (error) {
            console.error('Error resending feedback requests:', error)
            alert('An error occurred while resending the requests.')
        } finally {
            setResendingFeedback(false)
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
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Navigation & Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard/matches')}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold mb-6 inline-flex items-center gap-2 group transition-all"
                    >
                        <RotateCcw className="w-4 h-4 group-hover:-rotate-45 transition-transform" />
                        Back to Matches
                    </button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold text-gray-900">{formattedTime}</h1>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${match.status === 'confirmed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                    match.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        match.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {match.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Users className="w-4 h-4 text-indigo-500" />
                                    {allPlayers.length}/4 Confirmed
                                </span>
                                {match.court_booked && (
                                    <span className="flex items-center gap-1.5 font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {match.booked_court_text || 'Court Booked'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {match.status === 'pending' && (
                                <button
                                    onClick={handleConfirmMatch}
                                    disabled={actionLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm font-bold shadow-sm hover:shadow-md transition-all"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirm Match
                                </button>
                            )}
                            {match.status !== 'cancelled' && !isPast && (
                                <button
                                    onClick={handleCancelMatch}
                                    disabled={actionLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 text-sm font-bold shadow-sm transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Cancel Match
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 1. Match Results Section (Priority) */}
                <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transform transition-all">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50/50 to-white flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2 font-bold text-gray-900 uppercase tracking-wider">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            Match Results
                        </div>
                        <div className="flex items-center gap-2">
                            {!match.score_text && (
                                <button
                                    onClick={handleResendResult}
                                    disabled={resendingResult}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 font-bold transition-all disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    {resendingResult ? 'Sending...' : 'Resend Result Request'}
                                </button>
                            )}
                            <button
                                onClick={() => setIsEditingResults(!isEditingResults)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 font-bold transition-all"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                {isEditingResults ? 'Cancel Edit' : (match.score_text ? 'Edit Results' : 'Add Results')}
                            </button>
                        </div>
                    </div>

                    <div className="p-0"> {/* Removed padding for full-width table */}
                        {isEditingResults ? (
                            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead>
                                            <tr className="bg-gray-50/50">
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Team</th>
                                                {[1, 2, 3].map(i => (
                                                    <th key={i} className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">
                                                        S{i}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {[1, 2].map((teamNum) => {
                                                const teamPlayerIds = teamNum === 1 ? editTeam1Players : editTeam2Players
                                                const teamPlayers = teamPlayerIds.map(id => allPlayers.find(p => p.player_id === id)).filter(Boolean)
                                                const calculatedWinner = calculateWinnerFromScores(setScores)
                                                const isWinner = calculatedWinner === teamNum

                                                return (
                                                    <tr key={teamNum} className={`${isWinner ? 'bg-green-50/50' : ''} transition-colors`}>
                                                        <td className="px-6 py-6">
                                                            <div className="space-y-3">
                                                                {teamPlayers.map((p: any) => (
                                                                    <div key={p.player_id} className="flex items-center gap-4">
                                                                        <button
                                                                            onClick={() => handleSwapPlayer(p.player_id)}
                                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap"
                                                                            title={`Move to Team ${teamNum === 1 ? 2 : 1}`}
                                                                        >
                                                                            <ArrowRightLeft className="w-3 h-3" />
                                                                            Switch Team
                                                                        </button>
                                                                        <div className={`text-sm font-bold transition-colors ${isWinner ? 'text-green-800' : 'text-gray-900'}`}>
                                                                            {p.name}
                                                                            <span className="ml-2 text-[10px] text-gray-400 font-medium whitespace-nowrap">
                                                                                ({p.declared_skill_level?.toFixed(2) || '?.??'})
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {teamPlayers.length < 2 && (
                                                                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">
                                                                        Need {2 - teamPlayers.length} more player{2 - teamPlayers.length > 1 ? 's' : ''}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {[0, 1, 2].map((setIdx) => {
                                                            const score = setScores[setIdx][teamNum - 1]
                                                            const otherScore = setScores[setIdx][teamNum === 1 ? 1 : 0]
                                                            const setWon = parseInt(score) > parseInt(otherScore)

                                                            return (
                                                                <td key={setIdx} className="px-4 py-6">
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <input
                                                                            type="text"
                                                                            value={score}
                                                                            onChange={(e) => {
                                                                                const newScores = [...setScores]
                                                                                newScores[setIdx][teamNum - 1] = e.target.value
                                                                                setSetScores(newScores)
                                                                            }}
                                                                            className={`w-16 h-12 bg-white text-center text-xl font-black border-2 rounded-xl focus:ring-4 focus:outline-none transition-all ${setWon
                                                                                ? 'border-green-500 ring-green-100 text-green-700'
                                                                                : 'border-gray-100 focus:border-indigo-500 focus:ring-indigo-100 text-gray-900'
                                                                                }`}
                                                                            placeholder="0"
                                                                        />
                                                                        {setWon && (
                                                                            <div className="h-1 w-8 bg-green-500 rounded-full" />
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col items-center gap-4 pt-4 border-t border-gray-100">
                                    {calculateWinnerFromScores(setScores) ? (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-bold animate-in zoom-in duration-300">
                                            <Trophy className="w-4 h-4" />
                                            Team {calculateWinnerFromScores(setScores)} Projected Winner
                                        </div>
                                    ) : (
                                        <div className="text-sm font-medium text-gray-400">
                                            Enter scores to determine winner
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSaveResults}
                                        disabled={actionLoading || editTeam1Players.length !== 2 || editTeam2Players.length !== 2}
                                        className="w-full max-w-md py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {actionLoading ? 'Saving...' : <><CheckCircle2 className="w-5 h-5" /> Save Match Results</>}
                                    </button>
                                    {(editTeam1Players.length !== 2 || editTeam2Players.length !== 2) && (
                                        <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                                            Each team must have exactly 2 players
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : match?.score_text ? (() => {
                            const scoreText = match.score_text
                            const sets = scoreText.split(/[,|\s]+/).filter(s => s.includes('-')).map(s => s.trim().split('-'))
                            return (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead>
                                            <tr className="bg-gray-50/50">
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Team</th>
                                                {sets.map((_, i) => (
                                                    <th key={i} className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">
                                                        S{i + 1}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {[1, 2].map((teamNum) => {
                                                const isWinner = match.winner_team === teamNum
                                                const teamPlayers = teamNum === 1 ? match.team_1_player_details : match.team_2_player_details

                                                return (
                                                    <tr key={teamNum} className={`${isWinner ? 'bg-green-50/50' : ''} transition-colors`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="space-y-1">
                                                                    {teamPlayers?.map((p: any) => (
                                                                        <div key={p.player_id} className={`text-sm font-bold transition-colors ${isWinner ? 'text-green-800' : 'text-gray-900'}`}>
                                                                            {p.name}
                                                                            <span className="ml-2 text-[10px] text-gray-400 font-medium">
                                                                                ({p.declared_skill_level?.toFixed(2) || '?.??'})
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {isWinner && (
                                                                    <div className="bg-green-500 text-white rounded-full p-0.5 shadow-sm ml-2">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {sets.map((setValues, i) => {
                                                            const score = setValues[teamNum - 1]
                                                            const otherScore = setValues[teamNum === 1 ? 1 : 0]
                                                            const setWon = Number(score) > Number(otherScore)

                                                            return (
                                                                <td key={i} className="px-4 py-4 text-center">
                                                                    <div className={`text-xl font-black ${setWon
                                                                        ? 'text-green-600 relative inline-block'
                                                                        : 'text-gray-300'
                                                                        }`}>
                                                                        {score}
                                                                        {setWon && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-green-500 rounded-full" />}
                                                                    </div>
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })() : (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mx-8 my-8">
                                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">No results recorded yet</h3>
                                <p className="text-gray-500 mb-6">Match is confirmed, but scores have not been reported.</p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={handleResendResult}
                                        className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 shadow-lg hover:shadow-amber-200 transition-all disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5" />
                                        Resend Result Request
                                    </button>
                                    <button
                                        onClick={() => setIsEditingResults(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 border border-indigo-200 rounded-xl font-bold hover:bg-indigo-50 shadow-sm transition-all"
                                    >
                                        <Edit2 className="w-5 h-5" />
                                        Manually Enter Result
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Feedback Section */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                            Match Feedback
                        </div>
                        {feedback.length < 4 && (
                            <button
                                onClick={handleResendFeedback}
                                disabled={resendingFeedback}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-bold transition-all disabled:opacity-50 text-xs shadow-sm hover:shadow-md"
                            >
                                <Send className="w-3.5 h-3.5" />
                                {resendingFeedback ? 'Resending...' : 'Resend Feedback Request'}
                            </button>
                        )}
                    </div>

                    {feedback.length > 0 ? (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {allPlayers.map(player => {
                                    const received = feedback.filter(f => f.rated_player_id === player.player_id)
                                    const avgScore = received.length > 0
                                        ? (received.reduce((acc, curr) => acc + curr.rating, 0) / received.length).toFixed(1)
                                        : 'N/A'

                                    return (
                                        <div key={player.player_id} className="p-5 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full hover:shadow-lg transition-all border-b-4 border-b-indigo-500/10">
                                            <div className="flex items-center gap-3 mb-4 border-b border-gray-50 pb-4">
                                                <div className="h-10 w-10 text-lg flex items-center justify-center bg-indigo-50 rounded-xl text-indigo-600 font-black">
                                                    {player.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-gray-900 truncate" title={player.name}>{player.name}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest leading-none">Rec: {received.length}</p>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Impact Score</p>
                                                <div className={`text-4xl font-black tracking-tighter ${avgScore === 'N/A' ? 'text-gray-200' :
                                                    Number(avgScore) >= 8 ? 'text-green-600' :
                                                        Number(avgScore) >= 6 ? 'text-amber-500' : 'text-red-500'
                                                    }`}>
                                                    {avgScore}<span className="text-base text-gray-300 font-bold ml-0.5">/10</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mt-auto">
                                                {received.map(f => (
                                                    <div key={f.feedback_id} className="flex items-center gap-2 text-xs bg-gray-50/50 p-2 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                                                        <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg font-black text-[10px] text-white shadow-sm ${f.rating >= 8 ? 'bg-green-500' : f.rating >= 6 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}>
                                                            {f.rating}
                                                        </span>
                                                        <span className="text-gray-500 font-medium truncate">
                                                            from {f.rater?.name.split(' ')[0] || 'Unknown'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {received.length === 0 && (
                                                    <div className="py-2 px-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                                                        <AlertCircle className="w-3.5 h-3.5 text-gray-300" />
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No ratings yet</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Matrix */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/30 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Feedback Matrix</h2>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Giver (Cols) → Receiver (Rows)</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100 text-center">
                                        <thead>
                                            <tr>
                                                <th className="px-6 py-4 bg-gray-50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-100">Receiver</th>
                                                {allPlayers.map(p => (
                                                    <th key={p.player_id} className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[120px]">
                                                        By {p.name.split(' ')[0]}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {allPlayers.map((rowPlayer) => (
                                                <tr key={rowPlayer.player_id} className="group hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-5 whitespace-nowrap text-left border-r border-gray-100 font-bold text-gray-900 text-sm">
                                                        {rowPlayer.name}
                                                    </td>
                                                    {allPlayers.map((colPlayer) => {
                                                        const fb = feedback.find(f =>
                                                            f.player_id === colPlayer.player_id &&
                                                            f.rated_player_id === rowPlayer.player_id
                                                        )
                                                        const isSelf = rowPlayer.player_id === colPlayer.player_id

                                                        if (isSelf) {
                                                            return (
                                                                <td key={colPlayer.player_id} className="p-3">
                                                                    <div className="w-12 h-12 mx-auto rounded-xl bg-gray-100 flex items-center justify-center opacity-30">
                                                                        <Users className="w-5 h-5 text-gray-400" />
                                                                    </div>
                                                                </td>
                                                            )
                                                        }

                                                        return (
                                                            <td key={colPlayer.player_id} className="p-3">
                                                                {fb ? (
                                                                    <div className={`w-12 h-12 mx-auto flex items-center justify-center rounded-2xl text-xl font-black shadow-sm transition-all group-hover:scale-110 ${fb.rating >= 8 ? 'bg-green-50 text-green-600 border border-green-200' :
                                                                        fb.rating >= 6 ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                                                            'bg-red-50 text-red-600 border border-red-200'
                                                                        }`}>
                                                                        {fb.rating}
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-12 h-12 mx-auto flex items-center justify-center text-gray-200">
                                                                        <span className="text-xl font-black tracking-widest">—</span>
                                                                    </div>
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
                    ) : (
                        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                            <MessageSquare className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No feedback received yet</h3>
                            <p className="text-gray-500 mb-2 max-w-xs mx-auto">Feedback requests are usually sent a few hours after the match ends.</p>
                        </div>
                    )}
                </div>

                {/* 3. Collapsible Demographic Info (Booking & Invites) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => setDemoCollapsed(!demoCollapsed)}
                        className="w-full px-6 py-5 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm transition-transform group-hover:scale-110">
                                <Clock className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-lg font-bold text-gray-900 leading-none mb-1">Match Info & Invites</h2>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                    {isPast ? 'Archives • Started ' + formattedTime.split(',')[0] : 'Current • Coordination & Booking'}
                                </p>
                            </div>
                        </div>
                        {demoCollapsed ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        )}
                    </button>

                    {!demoCollapsed && (
                        <div className="p-6 space-y-8 animate-in slide-in-from-top-4 duration-300">
                            {/* Court Booking */}
                            <div className={`p-6 rounded-2xl border-2 transition-all ${match.court_booked ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100'
                                }`}>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-2xl ${match.court_booked ? 'bg-green-500 text-white' : 'bg-red-500 text-white shadow-xl shadow-red-100 animate-pulse'}`}>
                                            <Calendar className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-gray-900">{match.court_booked ? 'Court Secured' : 'Action Required'}</h3>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{match.court_booked ? 'Booking confirmed' : 'No court details found'}</p>
                                        </div>
                                    </div>
                                    {!isPast && (
                                        <button
                                            onClick={() => setIsEditingBooking(!isEditingBooking)}
                                            className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 font-bold text-sm shadow-sm transition-all"
                                        >
                                            {isEditingBooking ? 'Cancel' : 'Edit Booking Detail'}
                                        </button>
                                    )}
                                </div>

                                {isEditingBooking ? (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:border-indigo-500 transition-colors" onClick={() => setEditCourtBooked(!editCourtBooked)}>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${editCourtBooked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                                                        {editCourtBooked && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-700 uppercase tracking-widest">Mark as officially booked</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Court Name / Location</label>
                                                    <input
                                                        type="text"
                                                        value={editCourtText}
                                                        onChange={(e) => setEditCourtText(e.target.value)}
                                                        placeholder="e.g. Court 7, Stadium Court..."
                                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 font-bold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 cursor-pointer" onClick={() => setNotifyPlayersOnUpdate(!notifyPlayersOnUpdate)}>
                                                    <div className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${notifyPlayersOnUpdate ? 'bg-amber-500 border-amber-500' : 'bg-white border-amber-200'}`}>
                                                        {notifyPlayersOnUpdate && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-amber-800 uppercase tracking-widest leading-none mb-1">Broadcast Update?</p>
                                                        <p className="text-xs text-amber-700 font-bold">Resend confirmation SMS to all 4 players.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleSaveBooking}
                                                    disabled={actionLoading}
                                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-50"
                                                >
                                                    {actionLoading ? 'Updating...' : 'Save & Confirm Details'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : match.court_booked && match.booked_court_text && (
                                    <div className="bg-white p-6 rounded-2xl border border-green-200 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                                            <Trophy className="w-6 h-6 text-green-500" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-green-400 uppercase tracking-widest">Designated Spot</div>
                                            <div className="text-2xl font-black text-green-700 leading-none">{match.booked_court_text}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Confirmed Players List */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2 font-black text-gray-900 uppercase tracking-widest text-xs">
                                        <Users className="w-4 h-4 text-green-500" />
                                        Confirmed Players
                                    </div>
                                    {allPlayers.length > 0 ? (
                                        <div className="space-y-3">
                                            {allPlayers.map((player) => (
                                                <div key={player.player_id} className="group relative flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-green-200 hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                        <div>
                                                            <p className="font-black text-gray-900 text-sm leading-none mb-1 uppercase tracking-tight">{player.name}</p>
                                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Level {player.declared_skill_level}</p>
                                                        </div>
                                                    </div>
                                                    {!isPast && (
                                                        <button
                                                            onClick={() => handleRemovePlayer(player.player_id)}
                                                            disabled={actionLoading}
                                                            className="p-2 text-red-100 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-0"
                                                            title="Remove Player"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-12 px-6 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-100 text-center">
                                            <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-relaxed">Waitlist is currently empty<br />Nobody confirmed yet</p>
                                        </div>
                                    )}
                                </div>

                                {/* Invites List */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2 font-black text-gray-900 uppercase tracking-widest text-xs">
                                            <Send className="w-4 h-4 text-indigo-500" />
                                            Active Invites
                                        </div>
                                        {!showInvitePanel && !isPast && (allPlayers.length < 4) && (
                                            <button
                                                onClick={() => setShowInvitePanel(true)}
                                                className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                                            >
                                                + New Invite
                                            </button>
                                        )}
                                    </div>

                                    {showInvitePanel && (
                                        <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 animate-in slide-in-from-right-4 duration-300">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-white font-black text-xs uppercase tracking-widest">Player Outreach</h4>
                                                <XCircle className="w-4 h-4 text-indigo-300 cursor-pointer hover:text-white" onClick={() => setShowInvitePanel(false)} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Type name..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full px-4 py-3 bg-indigo-500/30 border border-white/20 rounded-xl mb-4 focus:ring-2 focus:ring-white placeholder-indigo-200 text-white font-bold"
                                                autoFocus
                                            />
                                            {searchResults.length > 0 && (
                                                <div className="max-h-48 overflow-y-auto space-y-2 mb-4 scrollbar-hide">
                                                    {searchResults.map((player) => (
                                                        <div
                                                            key={player.player_id}
                                                            onClick={() => togglePlayerSelection(player.player_id)}
                                                            className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${selectedToInvite.has(player.player_id)
                                                                ? 'bg-white shadow-lg scale-[1.02]'
                                                                : 'bg-white/10 hover:bg-white/20'
                                                                }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded border-2 transition-colors ${selectedToInvite.has(player.player_id) ? 'bg-indigo-600 border-indigo-600' : 'border-white/30'}`}>
                                                                {selectedToInvite.has(player.player_id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                            </div>
                                                            <div>
                                                                <p className={`text-sm font-black uppercase leading-none mb-1 ${selectedToInvite.has(player.player_id) ? 'text-indigo-900' : 'text-white'}`}>{player.name}</p>
                                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedToInvite.has(player.player_id) ? 'text-indigo-400' : 'text-indigo-200'}`}>Lvl {player.declared_skill_level}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {selectedToInvite.size > 0 && (
                                                <button
                                                    onClick={handleSendInvites}
                                                    disabled={actionLoading}
                                                    className="w-full py-4 bg-white text-indigo-600 rounded-xl font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-800/40 transform hover:-translate-y-0.5 transition-all text-sm"
                                                >
                                                    Send {selectedToInvite.size} Invites
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {invites.length > 0 ? (
                                            invites.map((invite) => {
                                                const config = statusConfig[invite.status] || statusConfig.sent
                                                return (
                                                    <div key={invite.invite_id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-sm transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-1.5 rounded-lg ${config.bg.replace('100', '50')} ${config.text}`}>
                                                                <Clock className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-gray-900 text-sm leading-none mb-1 uppercase tracking-tight">{invite.player?.name || 'Unknown'}</p>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sent {new Date(invite.sent_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${config.bg} ${config.text} ${config.bg.replace('100', '200')}`}>
                                                            {config.label}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="py-12 px-6 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-100 text-center">
                                                <Send className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Zero Outbound activity</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
