'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
    ArrowLeft,
    ArrowRightLeft,
    History,
    Trash2,
    Check,
    RefreshCw,
    UserPlus
} from 'lucide-react'
import { formatLocalizedTime, isPastTime } from '@/utils/time-utils'
import { authFetch } from '@/utils/auth-fetch'


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
    status: 'sent' | 'accepted' | 'declined' | 'expired' | 'maybe' | 'pending_sms' | 'removed'
    sent_at: string
    responded_at: string | null
    player?: Player
    timezone?: string
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
    created_at: string
    clubs?: {
        name: string
        timezone: string
    }
    player_groups?: {
        name: string
    }
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
    removed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Removed', icon: '🚫' },
    pending_sms: { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Queued (Quiet Hours)', icon: '🌙' }
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
    const [isEditingTime, setIsEditingTime] = useState(false)
    const [editTime, setEditTime] = useState('')

    // For direct additions
    const [addingDirectlyToTeam, setAddingDirectlyToTeam] = useState<{ playerId: string; name: string } | null>(null)

    // For inline score editing
    const [isEditingResults, setIsEditingResults] = useState(false)
    const [setScores, setSetScores] = useState<string[][]>([['', ''], ['', ''], ['', '']])
    const [_correctedWinner, setCorrectedWinner] = useState<number | undefined>(undefined)
    const [editTeam1Players, setEditTeam1Players] = useState<string[]>([])
    const [editTeam2Players, setEditTeam2Players] = useState<string[]>([])

    // For collapsible demographic section
    const [demoCollapsed, setDemoCollapsed] = useState<boolean>(false)
    const [resultsCollapsed, setResultsCollapsed] = useState<boolean>(true)
    const [feedbackCollapsed, setFeedbackCollapsed] = useState<boolean>(true)
    const initializedMatchId = useRef<string | null>(null)

    // Nudge/Resend states
    const [resendingResult, setResendingResult] = useState(false)
    const [resendingFeedback, setResendingFeedback] = useState(false)

    const isPast = useMemo(() => {
        if (!match?.scheduled_time) return false
        return isPastTime(match.scheduled_time)
    }, [match?.scheduled_time])

    const allPlayers = useMemo(() => [
        ...(match?.team_1_player_details || []),
        ...(match?.team_2_player_details || [])
    ], [match?.team_1_player_details, match?.team_2_player_details])

    const formattedTime = match ? formatLocalizedTime(match.scheduled_time, match.clubs?.timezone) : ''

    // Merge confirmed players who might not have an invite record (e.g. the originator)
    const displayInvites = useMemo(() => {
        if (!match) return []
        const merged = [...invites]

        allPlayers.forEach(player => {
            if (!merged.find(i => i.player_id === player.player_id)) {
                // Add synthetic "accepted" invite for this confirmed player
                merged.push({
                    invite_id: `confirmed-${player.player_id}`,
                    match_id: match.match_id,
                    player_id: player.player_id,
                    status: 'accepted',
                    sent_at: match.created_at,
                    responded_at: match.created_at,
                    player: player
                })
            }
        })

        // Sort: Accepted first, then by sent_at
        return merged.sort((a, b) => {
            if (a.status === 'accepted' && b.status !== 'accepted') return -1
            if (a.status !== 'accepted' && b.status === 'accepted') return 1
            return new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()
        })
    }, [invites, allPlayers, match?.match_id, match?.created_at])

    // Effect to handle default collapse state - only runs once per match ID
    useEffect(() => {
        if (match && initializedMatchId.current !== match.match_id) {
            if (isPast) {
                setDemoCollapsed(true)
                setResultsCollapsed(false)
                setFeedbackCollapsed(false)
            } else {
                setDemoCollapsed(false)
                setResultsCollapsed(true)
                setFeedbackCollapsed(true)
            }
            initializedMatchId.current = match.match_id
        }
    }, [match, isPast])

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

            // Sync edit time
            if (match.scheduled_time) {
                // We need to format it for datetime-local input (YYYY-MM-DDTHH:mm)
                // The API returns UTC ISO, we want to convert it to the club's local time for editing
                // But for simplicity, we'll just use the raw ISO and hope the browser handles it or just let it be.
                // Actually, let's just use the raw value for now.
                setEditTime(match.scheduled_time.split('.')[0].slice(0, 16))
            }
        }
    }, [match, isEditingResults])


    // Fetch match and invites
    useEffect(() => {
        async function fetchData() {
            try {
                const [matchRes, invitesRes, feedbackRes] = await Promise.all([
                    authFetch(`/api/matches/${matchId}`),
                    authFetch(`/api/matches/${matchId}/invites`),
                    authFetch(`/api/matches/${matchId}/feedback`)
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
                const res = await authFetch(`/api/players/search?club_id=${match.club_id}&q=${encodeURIComponent(searchTerm)}`)

                if (res.ok) {
                    const data = await res.json()
                    // Exclude only active/pending invitations. 
                    // Allow re-inviting those who were removed, declined, or never responded.
                    const activeInviteStatuses = ['accepted', 'sent', 'maybe', 'pending_sms']
                    const alreadyInvitedIds = new Set(
                        invites
                            .filter(i => activeInviteStatuses.includes(i.status))
                            .map(i => i.player_id)
                    )
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
            const res = await authFetch(`/api/matches/${matchId}`, {
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
            const res = await authFetch(`/api/matches/${matchId}`, {
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
            const res = await authFetch(`/api/matches/${matchId}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_ids: Array.from(selectedToInvite)
                })
            })

            if (res.ok) {
                // Refresh invites
                const invitesRes = await authFetch(`/api/matches/${matchId}/invites`)
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
            const res = await authFetch(`/api/matches/${matchId}`, {
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
        if (!match || !confirm('Remove this player/invite from the match?')) return
        setActionLoading(true)
        try {
            const res = await authFetch(`/api/matches/${matchId}/players/${playerId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                // Refresh match data
                const matchRes = await authFetch(`/api/matches/${matchId}`)
                if (matchRes.ok) {
                    const matchData = await matchRes.json()
                    setMatch(matchData.match)
                }
                // Also refresh invites to show "Removed" status
                const invitesRes = await authFetch(`/api/matches/${matchId}/invites`)
                if (invitesRes.ok) {
                    const invitesData = await invitesRes.json()
                    setInvites(invitesData.invites || [])
                }
            }
        } catch (error) {
            console.error('Error removing player:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleAddPlayerDirectly = async (playerId: string, team: number) => {
        if (!match) return
        setActionLoading(true)
        try {
            const res = await authFetch(`/api/matches/${matchId}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, team })
            })
            if (res.ok) {
                const matchRes = await authFetch(`/api/matches/${matchId}`)
                if (matchRes.ok) {
                    const matchData = await matchRes.json()
                    setMatch(matchData.match)
                }
                setAddingDirectlyToTeam(null)
                setShowInvitePanel(false)
                setSelectedToInvite(new Set())
                setSearchTerm('')
            }
        } catch (error) {
            console.error('Error adding player directly:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleSaveTime = async () => {
        if (!match || !editTime) return
        setActionLoading(true)
        try {
            const res = await authFetch(`/api/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduled_time: editTime })
            })
            if (res.ok) {
                const data = await res.json()
                setMatch(data.match)
                setIsEditingTime(false)
            }
        } catch (error) {
            console.error('Error saving time:', error)
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

            const res = await authFetch(`/api/matches/${matchId}`, {
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
            const res = await authFetch(`/api/matches/${matchId}/result-nudge`, {
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
            const res = await authFetch(`/api/matches/${matchId}/feedback?force=true`, {
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



    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Navigation & Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard/matches')}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold mb-6 inline-flex items-center gap-2 group transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Matches
                    </button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                {isEditingTime ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="datetime-local"
                                            value={editTime}
                                            onChange={(e) => setEditTime(e.target.value)}
                                            className="px-3 py-1 bg-white border border-indigo-300 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-indigo-100 outline-none"
                                        />
                                        <button
                                            onClick={handleSaveTime}
                                            disabled={actionLoading}
                                            className="p-1 px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                        >
                                            {actionLoading ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => setIsEditingTime(false)}
                                            className="p-1 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group">
                                        <h1 className="text-2xl font-bold text-gray-900">{formattedTime}</h1>
                                        {!isPast && (
                                            <button
                                                onClick={() => setIsEditingTime(true)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-indigo-400 hover:text-indigo-600 transition-all"
                                                title="Edit Time"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${match.status === 'confirmed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                    match.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        match.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {match.status}
                                </span>
                                {match.player_groups?.name && (
                                    <span className="px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                                        Group: {match.player_groups.name}
                                    </span>
                                )}
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

                {/* Dynamic Section Ordering */}
                <div className="flex flex-col gap-8">
                    {(() => {
                        const ResultsSection = (
                            <div key="results" className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div
                                    onClick={() => setResultsCollapsed(!resultsCollapsed)}
                                    className="w-full px-8 py-6 flex justify-between items-center bg-gray-50/50 hover:bg-gray-50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                                            <Trophy className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="text-left">
                                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Match Results</h2>
                                            <p className="text-xs text-gray-400 font-medium">Record and manage scores</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {(isPast || match.status === 'completed') && (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                {!match.score_text && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleResendResult() }}
                                                        disabled={resendingResult}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100 font-bold transition-all disabled:opacity-50 text-xs"
                                                    >
                                                        <Send className="w-3.5 h-3.5" />
                                                        {resendingResult ? 'Sending...' : 'Request Score'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setIsEditingResults(!isEditingResults) }}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 font-bold transition-all text-xs"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    {isEditingResults ? 'Cancel' : (match.score_text ? 'Edit Score' : 'Add Score')}
                                                </button>
                                            </div>
                                        )}
                                        <div className={`p-2 rounded-lg transition-colors ${resultsCollapsed ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-500'}`}>
                                            {resultsCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>

                                {!resultsCollapsed && (
                                    <div className="p-0 animate-in slide-in-from-top-4 duration-300">
                                        {isEditingResults ? (
                                            <div className="p-8 space-y-8 bg-gradient-to-b from-white to-gray-50/30">
                                                <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                                                    <table className="min-w-full divide-y divide-gray-100">
                                                        <thead>
                                                            <tr className="bg-gray-50/50">
                                                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-50">Teams</th>
                                                                {[1, 2, 3].map(i => (
                                                                    <th key={i} className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">
                                                                        Set {i}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {[1, 2].map((teamNum) => {
                                                                const teamPlayerIds = teamNum === 1 ? editTeam1Players : editTeam2Players
                                                                const teamPlayers = teamPlayerIds.map(id => allPlayers.find(p => p.player_id === id)).filter((p): p is Player => !!p)
                                                                const calculatedWinner = calculateWinnerFromScores(setScores)
                                                                const isWinner = calculatedWinner === teamNum

                                                                return (
                                                                    <tr key={teamNum} className={`${isWinner ? 'bg-green-50/30' : ''} transition-colors group`}>
                                                                        <td className="px-8 py-6 border-r border-gray-50">
                                                                            <div className="space-y-4">
                                                                                {teamPlayers.map((p: Player) => (
                                                                                    <div key={p.player_id} className="flex items-center gap-4 group/row">
                                                                                        <button
                                                                                            onClick={() => handleSwapPlayer(p.player_id)}
                                                                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg opacity-0 group-hover/row:opacity-100 hover:bg-indigo-100 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap"
                                                                                            title={`Move to Team ${teamNum === 1 ? 2 : 1}`}
                                                                                        >
                                                                                            <ArrowRightLeft className="w-3 h-3 inline mr-1" />
                                                                                            Switch
                                                                                        </button>
                                                                                        <div className={`text-sm font-bold transition-colors ${isWinner ? 'text-green-800' : 'text-gray-900'}`}>
                                                                                            {p.name}
                                                                                            <span className="ml-2 text-[10px] text-gray-400 font-medium opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                                                ({p.declared_skill_level?.toFixed(2) || '?.??'})
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                                {teamPlayers.length < 2 && (
                                                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-tighter bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 inline-flex">
                                                                                        <AlertCircle className="w-3 h-3" />
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
                                                                                    <div className="flex flex-col items-center gap-2">
                                                                                        <input
                                                                                            type="text"
                                                                                            value={score}
                                                                                            onChange={(e) => {
                                                                                                const newScores = [...setScores]
                                                                                                newScores[setIdx][teamNum - 1] = e.target.value
                                                                                                setSetScores(newScores)
                                                                                            }}
                                                                                            className={`w-16 h-14 bg-white text-center text-2xl font-black border-2 rounded-2xl focus:ring-8 focus:outline-none transition-all shadow-sm ${setWon
                                                                                                ? 'border-green-500 ring-green-100 text-green-700 shadow-green-100/50'
                                                                                                : 'border-gray-50 focus:border-indigo-500 focus:ring-indigo-50 text-gray-900'
                                                                                                }`}
                                                                                            placeholder="0"
                                                                                        />
                                                                                        {setWon && <div className="h-1.5 w-10 bg-green-500 rounded-full animate-in zoom-in duration-300" />}
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

                                                <div className="flex flex-col items-center gap-6 pt-6 border-t border-gray-100">
                                                    {calculateWinnerFromScores(setScores) ? (
                                                        <div className="flex items-center gap-3 px-6 py-3 bg-green-100 text-green-800 rounded-2xl text-base font-black uppercase tracking-widest shadow-lg shadow-green-100 animate-in zoom-in duration-300">
                                                            <Trophy className="w-5 h-5" />
                                                            Team {calculateWinnerFromScores(setScores)} Won Match
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                            <div className="w-8 h-px bg-gray-100" />
                                                            Enter scores to determine winner
                                                            <div className="w-8 h-px bg-gray-100" />
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={handleSaveResults}
                                                        disabled={actionLoading || editTeam1Players.length !== 2 || editTeam2Players.length !== 2}
                                                        className="w-full max-w-md py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl hover:shadow-indigo-200/50 disabled:opacity-50 transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0"
                                                    >
                                                        {actionLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6" /> Save Match Results</>}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : match?.score_text ? (
                                            <div className="overflow-x-auto bg-gradient-to-b from-white to-gray-50/20 p-8">
                                                <div className="rounded-3xl border border-gray-100 bg-white shadow-xl overflow-hidden max-w-3xl mx-auto">
                                                    <table className="min-w-full text-center">
                                                        <thead>
                                                            <tr className="bg-gray-50/50">
                                                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-50">Teams</th>
                                                                {match.score_text.split(',').map((_, i) => (
                                                                    <th key={i} className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                        Set {i + 1}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {[1, 2].map(teamNum => {
                                                                const isWinner = match.winner_team === teamNum
                                                                const players = teamNum === 1 ? match.team_1_player_details : match.team_2_player_details
                                                                const sets = match.score_text!.split(',').map(s => s.trim().split('-'))

                                                                return (
                                                                    <tr key={teamNum} className={`${isWinner ? 'bg-indigo-50/20' : ''} transition-colors`}>
                                                                        <td className="px-8 py-6 text-left border-r border-gray-50">
                                                                            <div className="flex flex-col gap-1">
                                                                                {players?.map((p: Player) => (
                                                                                    <p key={p.player_id} className={`text-base font-black tracking-tight ${isWinner ? 'text-indigo-900' : 'text-gray-900'}`}>{p.name}</p>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        {sets.map((s, i) => (
                                                                            <td key={i} className={`px-6 py-6 text-4xl font-black transition-all ${isWinner ? 'text-indigo-600 scale-110' : 'text-gray-200'}`}>
                                                                                {s[teamNum - 1]}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-16 bg-gray-50/50 m-6 rounded-2xl border-2 border-dashed border-gray-100">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                    <History className="w-8 h-8 text-gray-200" />
                                                </div>
                                                <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Awaiting match results</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )

                        const FeedbackSection = (
                            <div key="feedback" className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div
                                    onClick={() => setFeedbackCollapsed(!feedbackCollapsed)}
                                    className="w-full px-8 py-6 flex justify-between items-center bg-gray-50/50 hover:bg-gray-50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <div className="text-left">
                                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Player Feedback</h2>
                                            <p className="text-xs text-gray-400 font-medium">Anonymous ratings & reviews</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {(isPast || match.status === 'completed') && feedback.length < 4 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleResendFeedback() }}
                                                disabled={resendingFeedback}
                                                className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 font-bold transition-all disabled:opacity-50 text-xs"
                                            >
                                                {resendingFeedback ? 'Resending...' : 'Resend Requests'}
                                            </button>
                                        )}
                                        <div className={`p-2 rounded-lg transition-colors ${feedbackCollapsed ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-500'}`}>
                                            {feedbackCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>

                                {!feedbackCollapsed && (
                                    <div className="p-8 space-y-8 animate-in slide-in-from-top-4 duration-300">
                                        {feedback.length > 0 ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                    {allPlayers.map(player => {
                                                        const received = feedback.filter(f => f.rated_player_id === player.player_id)
                                                        const avgScore = received.length > 0
                                                            ? (received.reduce((acc, curr) => acc + curr.rating, 0) / received.length).toFixed(1)
                                                            : 'N/A'
                                                        return (
                                                            <div key={player.player_id} className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                                                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-xs text-gray-400 mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                                    {player.name?.[0]}
                                                                </div>
                                                                <p className="font-black text-gray-900 truncate mb-1 text-sm uppercase tracking-tight">{player.name}</p>
                                                                <div className="flex items-baseline gap-1">
                                                                    <p className="text-4xl font-black text-indigo-600 tracking-tighter">{avgScore}</p>
                                                                    <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Avg</p>
                                                                </div>
                                                                <div className="mt-4 pt-4 border-t border-gray-50">
                                                                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-2">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${received.length >= 2 ? 'bg-green-500' : 'bg-amber-400'}`} />
                                                                        {received.length} Responses
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="pt-8 border-t border-gray-100">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Detailed Response Matrix</h3>
                                                    </div>
                                                    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                                                        <table className="min-w-full divide-y divide-gray-100 text-center">
                                                            <thead className="bg-gray-50/50">
                                                                <tr>
                                                                    <th className="px-6 py-4 bg-gray-50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest sticky left-0 z-10 border-r border-gray-100">
                                                                        Receiver
                                                                    </th>
                                                                    {allPlayers.map(p => (
                                                                        <th key={p.player_id} className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[120px]">
                                                                            Giver:<br />
                                                                            <span className="text-indigo-600 text-xs">{p.name?.split(' ')[0]}</span>
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-50">
                                                                {allPlayers.map((rowPlayer) => (
                                                                    <tr key={rowPlayer.player_id} className="hover:bg-gray-50/50 transition-colors">
                                                                        <td className="px-6 py-4 whitespace-nowrap text-left border-r border-gray-100 bg-gray-50 sticky left-0 font-bold text-gray-900 text-sm">
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
                                                                                    <td key={colPlayer.player_id} className="bg-gray-100/50 p-2">
                                                                                        <div className="w-full h-full min-h-[44px] flex items-center justify-center relative opacity-20">
                                                                                            <svg width="100%" height="100%" className="absolute inset-0">
                                                                                                <defs>
                                                                                                    <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                                                                                        <line x1="0" y1="0" x2="0" y2="10" style={{ stroke: 'black', strokeWidth: 1 }} />
                                                                                                    </pattern>
                                                                                                </defs>
                                                                                                <rect width="100%" height="100%" fill="url(#diagonalHatch)" />
                                                                                            </svg>
                                                                                        </div>
                                                                                    </td>
                                                                                )
                                                                            }

                                                                            return (
                                                                                <td key={colPlayer.player_id} className="p-4 align-middle">
                                                                                    {fb ? (
                                                                                        <div className="flex flex-col items-center gap-1">
                                                                                            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg font-black shadow-sm ${fb.rating >= 8 ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                                                fb.rating >= 6 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                                                                    'bg-red-50 text-red-700 border border-red-200'
                                                                                                }`}>
                                                                                                {fb.rating}
                                                                                            </span>
                                                                                            {fb.comment && (
                                                                                                <div className="group relative">
                                                                                                    <MessageSquare className="w-3 h-3 text-gray-300 cursor-help" />
                                                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-xl">
                                                                                                        &quot;{fb.comment}&quot;
                                                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="w-2 h-2 rounded-full bg-gray-100 mx-auto" />
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
                                            </>
                                        ) : (
                                            <div className="text-center py-16 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                    <MessageSquare className="w-8 h-8 text-gray-100" />
                                                </div>
                                                <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Awaiting player feedback</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )

                        const InfoSection = (
                            <div key="info" className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div
                                    onClick={() => setDemoCollapsed(!demoCollapsed)}
                                    className="w-full px-8 py-6 flex justify-between items-center bg-gray-50/50 hover:bg-gray-50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                                            <Clock className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <div className="text-left">
                                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Match Info & Invites</h2>
                                            <p className="text-xs text-gray-400 font-medium">Logistics and player management</p>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-lg transition-colors ${demoCollapsed ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-500'}`}>
                                        {demoCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                    </div>
                                </div>

                                {!demoCollapsed && (
                                    <div className="p-8 space-y-10 animate-in slide-in-from-top-4 duration-300">
                                        {/* Booking Info */}
                                        <div className={`p-8 rounded-3xl border-2 transition-all shadow-sm ${match.court_booked ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-5">
                                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${match.court_booked ? 'bg-white text-green-500 border border-green-100' : 'bg-white text-red-500 border border-red-100'
                                                        }`}>
                                                        <Calendar className="w-7 h-7" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-gray-900 mb-1 tracking-tight">
                                                            {match.court_booked ? 'Court Secured' : 'Action Required'}
                                                        </h3>
                                                        <p className="text-gray-500 text-sm font-medium">
                                                            {match.booked_court_text || 'No court details found. Please update match if court is booked.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {!isPast && (
                                                    <button
                                                        onClick={() => setIsEditingBooking(!isEditingBooking)}
                                                        className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all hover:scale-110 active:scale-95"
                                                        title="Edit Booking"
                                                    >
                                                        <Edit2 className="w-6 h-6" />
                                                    </button>
                                                )}
                                            </div>

                                            {isEditingBooking && (
                                                <div className="mt-8 bg-white p-6 rounded-2xl border border-indigo-100 space-y-5 shadow-xl animate-in zoom-in-95 duration-200">
                                                    <div className="flex flex-col gap-4">
                                                        <label className="flex items-center gap-4 cursor-pointer group p-3 hover:bg-gray-50 rounded-xl transition-colors">
                                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editCourtBooked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                                                                {editCourtBooked && <Check className="w-4 h-4 text-white" />}
                                                            </div>
                                                            <input type="checkbox" checked={editCourtBooked} onChange={(e) => setEditCourtBooked(e.target.checked)} className="hidden" />
                                                            <span className="text-sm font-black text-gray-700 uppercase tracking-widest">Court is Booked</span>
                                                        </label>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Court Details</p>
                                                            <input
                                                                type="text"
                                                                value={editCourtText}
                                                                onChange={(e) => setEditCourtText(e.target.value)}
                                                                className="w-full px-5 py-3 bg-gray-50 border-2 border-gray-50 focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-gray-900 transition-all focus:ring-4 focus:ring-indigo-50 focus:outline-none"
                                                                placeholder="Location, Court Name, or Notes..."
                                                            />
                                                        </div>
                                                        <label className="flex items-center gap-3 cursor-pointer ml-1">
                                                            <input type="checkbox" checked={notifyPlayersOnUpdate} onChange={(e) => setNotifyPlayersOnUpdate(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                                            <span className="text-xs font-bold text-gray-500">Notify players of booking via SMS</span>
                                                        </label>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => setIsEditingBooking(false)}
                                                            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handleSaveBooking}
                                                            disabled={actionLoading}
                                                            className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-colors"
                                                        >
                                                            {actionLoading ? 'Saving...' : 'Save Updates'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Invites list */}
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                                                        Confirmed Players <span className="text-indigo-600 ml-1">({allPlayers.length}/4)</span>
                                                    </h3>
                                                </div>
                                                {!isPast && (
                                                    <button
                                                        onClick={() => setShowInvitePanel(!showInvitePanel)}
                                                        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 shadow-lg hover:shadow-indigo-100 transition-all flex items-center gap-2"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                        Add Players/Invites
                                                    </button>
                                                )}
                                            </div>

                                            {showInvitePanel && (
                                                <div className="p-6 bg-indigo-50/50 rounded-3xl space-y-4 animate-in slide-in-from-bottom-4 duration-300 border border-indigo-100">
                                                    <input
                                                        type="text"
                                                        placeholder="Search players by name..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="w-full px-6 py-3 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-gray-900 shadow-sm focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all"
                                                    />
                                                    {searchResults.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {searchResults.map(p => {
                                                                const isAddingToTeam = addingDirectlyToTeam?.playerId === p.player_id
                                                                return (
                                                                    <div
                                                                        key={p.player_id}
                                                                        onClick={() => !isAddingToTeam && togglePlayerSelection(p.player_id)}
                                                                        className={`group p-4 rounded-2xl cursor-pointer bg-white border-2 transition-all ${selectedToInvite.has(p.player_id) ? 'border-indigo-500 bg-indigo-50' : 'border-white hover:border-gray-100 hover:shadow-md'}`}
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs">
                                                                                    {p.name[0]}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-gray-900">{p.name}</p>
                                                                                    <p className="text-[10px] text-gray-400 font-medium">Level {p.declared_skill_level?.toFixed(2) || '?.??'}</p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); togglePlayerSelection(p.player_id) }}
                                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${selectedToInvite.has(p.player_id)
                                                                                        ? 'bg-indigo-600 text-white shadow-lg'
                                                                                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                                                        }`}
                                                                                >
                                                                                    {selectedToInvite.has(p.player_id) ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                                                                                    {selectedToInvite.has(p.player_id) ? 'Selected' : 'Invite'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleAddPlayerDirectly(p.player_id, 1) }}
                                                                                    className="px-3 py-1.5 bg-green-50 text-green-600 border border-green-100 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-all flex items-center gap-1"
                                                                                >
                                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                                    Confirm Now
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : searchTerm.length >= 2 && (
                                                        <p className="text-center py-4 text-sm font-medium text-gray-400">No matching players found</p>
                                                    )}
                                                    {selectedToInvite.size > 0 && (
                                                        <button
                                                            onClick={handleSendInvites}
                                                            disabled={actionLoading}
                                                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                                                        >
                                                            {actionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Send {selectedToInvite.size} Invites</>}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {displayInvites.length > 0 ? (
                                                    displayInvites.map(invite => {
                                                        const config = statusConfig[invite.status] || statusConfig.sent
                                                        return (
                                                            <div key={invite.invite_id} className="group relative flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-all ${config.bg} ${config.text}`}>
                                                                        {invite.player?.name?.[0] || '?'}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="font-bold text-gray-900 leading-none tracking-tight">{invite.player?.name}</p>
                                                                            {invite.status === 'accepted' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                                                            {invite.status === 'declined' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                                                            {invite.status === 'pending_sms' && <Clock className="w-3.5 h-3.5 text-indigo-400" />}
                                                                        </div>
                                                                        <div className={`text-[10px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1.5 ${config.text}`}>
                                                                            <div className={`w-1.5 h-1.5 rounded-full ${invite.status === 'accepted' ? 'bg-green-500' :
                                                                                invite.status === 'pending_sms' ? 'bg-indigo-400' : 'bg-gray-300'}`} />
                                                                            {config.label}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xl opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">
                                                                        {config.icon}
                                                                    </span>
                                                                    {invite.status === 'pending_sms' ? (
                                                                        <Clock className="w-4 h-4 text-indigo-300" />
                                                                    ) : (
                                                                        <Send className="w-4 h-4 text-gray-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                                                    )}
                                                                </div>

                                                                {invite.status !== 'removed' && invite.status !== 'declined' && (
                                                                    <div onClick={(e) => { e.stopPropagation(); handleRemovePlayer(invite.player_id) }} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                                        <div className="bg-white rounded-full p-1 shadow-md border border-red-50 hover:bg-red-50 transition-colors">
                                                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <div className="col-span-full py-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                                                            <UserPlus className="w-6 h-6 text-gray-300" />
                                                        </div>
                                                        <p className="text-sm font-bold text-gray-500">No players invited yet</p>
                                                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Click &quot;Send More Invites&quot; to start outreach</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )

                        return isPast ? (
                            <>
                                {ResultsSection}
                                {FeedbackSection}
                                {InfoSection}
                            </>
                        ) : (
                            <>
                                {InfoSection}
                                {ResultsSection}
                                {FeedbackSection}
                            </>
                        )
                    })()}
                </div>
            </div>
        </div >
    )
}
