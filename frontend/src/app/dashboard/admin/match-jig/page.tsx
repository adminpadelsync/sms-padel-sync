'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { PlayerColumn } from '../simulator/player-column'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    club_id: string
}

interface Message {
    id: string
    from: 'system' | 'player'
    text: string
    timestamp: Date
}

interface OutboxMessage {
    id: string
    to_number: string
    body: string
    created_at: string
}

interface ConfirmedMatch {
    match_id: string
    scheduled_time: string
    status: string
    team_1_players: string[]
    team_2_players: string[]
    feedback_collected: boolean
}

interface Club {
    club_id: string
    name: string
}

export default function MatchJigPage() {
    const [allPlayers, setAllPlayers] = useState<Player[]>([])
    const [selectedPlayers, setSelectedPlayers] = useState<(Player | null)[]>([null, null, null, null])
    const [currentMatch, setCurrentMatch] = useState<ConfirmedMatch | null>(null)
    const [conversations, setConversations] = useState<Record<string, Message[]>>({})
    const [isLoading, setIsLoading] = useState(false)
    const [feedbackLoading, setFeedbackLoading] = useState(false)
    const [clubs, setClubs] = useState<Club[]>([])
    const [currentClubId, setCurrentClubId] = useState<string>('')

    // Fetch players and clubs on mount
    useEffect(() => {
        fetchClubs()
    }, [])

    // Re-fetch players when club changes
    useEffect(() => {
        if (currentClubId) {
            fetchPlayers(currentClubId)
        }
    }, [currentClubId])

    const fetchClubs = async () => {
        try {
            console.log("DEBUG: Fetching clubs...");
            const response = await fetch('/api/clubs')
            if (response.ok) {
                const data = await response.json()
                const clubList = data.clubs || []
                console.log(`DEBUG: Found ${clubList.length} clubs`);
                setClubs(clubList)
                if (clubList.length > 0 && !currentClubId) {
                    console.log(`DEBUG: Setting initial club: ${clubList[0].name} (${clubList[0].club_id})`);
                    setCurrentClubId(clubList[0].club_id)
                }
            }
        } catch (error) {
            console.error('Error fetching clubs:', error)
        }
    }

    const fetchPlayers = async (clubId: string) => {
        try {
            console.log(`DEBUG: fetchPlayers called with clubId="${clubId}"`);
            if (!clubId) return;

            setIsLoading(true);
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/players?club_id=${clubId}&_t=${timestamp}`)

            if (response.ok) {
                const data = await response.json()
                const players = data.players || [];
                console.log(`DEBUG: Received ${players.length} players from API for club ${clubId}`);
                setAllPlayers(players)
            } else {
                console.error(`DEBUG: API error ${response.status} fetching players`);
            }
        } catch (error) {
            console.error('Error fetching players:', error)
        } finally {
            setIsLoading(false);
        }
    }

    // Client-side filter as a secondary safety measure
    const filteredPlayers = useMemo(() => {
        if (!currentClubId) return [];
        const filtered = allPlayers.filter(p => p.club_id === currentClubId);
        console.log(`DEBUG: Local filter: ${filtered.length}/${allPlayers.length} players match club_id ${currentClubId}`);
        return filtered;
    }, [allPlayers, currentClubId]);

    // Poll for outbox messages (intercepted SMS)
    useEffect(() => {
        const activePlayerPhones = selectedPlayers.filter(p => p !== null).map(p => p!.phone_number)
        if (activePlayerPhones.length === 0) return

        const pollOutbox = async () => {
            try {
                const response = await fetch('/api/sms-outbox')
                if (response.ok) {
                    const data = await response.json()
                    const messages: OutboxMessage[] = data.messages || []

                    for (const msg of messages) {
                        const player = selectedPlayers.find(p => p?.phone_number === msg.to_number)
                        if (player) {
                            const newMessage: Message = {
                                id: msg.id,
                                from: 'system',
                                text: msg.body,
                                timestamp: new Date(msg.created_at)
                            }

                            setConversations(prev => {
                                const existing = prev[player.player_id] || []
                                if (existing.some(m => m.id === msg.id)) return prev
                                return {
                                    ...prev,
                                    [player.player_id]: [...existing, newMessage]
                                }
                            })

                            // Mark as read so it doesn't pop up again
                            await fetch(`/api/sms-outbox/${msg.id}/read`, { method: 'POST' })
                        }
                    }
                }
            } catch (error) {
                console.error('Error polling outbox:', error)
            }
        }

        const interval = setInterval(pollOutbox, 2000)
        pollOutbox()
        return () => clearInterval(interval)
    }, [selectedPlayers])

    const handleSelectPlayer = (index: number, playerId: string) => {
        const player = filteredPlayers.find(p => p.player_id === playerId) || null
        const newSelected = [...selectedPlayers]
        newSelected[index] = player
        setSelectedPlayers(newSelected)

        if (player && !conversations[player.player_id]) {
            setConversations(prev => ({ ...prev, [player.player_id]: [] }))
        }
    }

    const handleFormMatch = async () => {
        const players = selectedPlayers.filter((p): p is Player => p !== null)
        if (players.length !== 4) {
            alert('Please select exactly 4 players.')
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch('/api/admin/create-confirmed-match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_ids: players.map(p => p.player_id),
                    club_id: currentClubId,
                    scheduled_time: new Date().toISOString()
                })
            })

            if (response.ok) {
                const data = await response.json()
                setCurrentMatch(data.match)
                alert('Match formed successfully! You can now test result reporting.')
            } else {
                const err = await response.json()
                const errorMessage = typeof err.detail === 'string' ? err.detail : (err.message || 'Failed to form match');
                alert(`Error: ${errorMessage}`)
            }
        } catch (error: any) {
            console.error('Error forming match:', error)
            alert(`Failed to form match: ${error.message || 'Unknown error'}`)
        } finally {
            setIsLoading(false)
        }
    }

    const handleTriggerFeedback = async () => {
        if (!currentMatch) return
        setFeedbackLoading(true)
        try {
            const response = await fetch(`/api/matches/${currentMatch.match_id}/feedback`, {
                method: 'POST'
            })
            if (response.ok) {
                alert('Feedback requests sent to all players!')
            } else {
                const err = await response.json()
                alert(`Error: ${err.detail || 'Failed to trigger feedback'}`)
            }
        } catch (error) {
            console.error('Error triggering feedback:', error)
        } finally {
            setFeedbackLoading(false)
        }
    }

    const handlePlayerReply = async (playerId: string, text: string) => {
        const player = selectedPlayers.find(p => p?.player_id === playerId)
        if (!player) return

        // Add to local UI immediately
        const userMsg: Message = {
            id: Date.now().toString(),
            from: 'player',
            text: text,
            timestamp: new Date()
        }
        setConversations(prev => ({
            ...prev,
            [playerId]: [...(prev[playerId] || []), userMsg]
        }))

        // Send to backend (Simulated SMS Inbox)
        try {
            await fetch('/api/sms-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_number: player.phone_number,
                    body: text
                })
            })

            // Re-fetch match status if a result might have been reported
            if (currentMatch) {
                const res = await fetch(`/api/matches/${currentMatch.match_id}`)
                if (res.ok) {
                    const data = await res.json()
                    setCurrentMatch(data.match)
                }
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <a href="/dashboard/admin" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 mb-2">
                            ← Back to Admin
                        </a>
                        <h1 className="text-2xl font-bold text-gray-900">Match Simulator Jig</h1>
                        <p className="text-gray-600">Simulate a real match flow with the Reasoner</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Testing Club:</label>
                        <select
                            className="bg-white border border-gray-300 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500"
                            value={currentClubId}
                            onChange={(e) => {
                                const newClubId = e.target.value;
                                console.log(`DEBUG: Club changed to ${newClubId}`);
                                setCurrentClubId(newClubId)
                                setSelectedPlayers([null, null, null, null])
                                setCurrentMatch(null)
                                setConversations({})
                            }}
                        >
                            {clubs.map(c => (
                                <option key={c.club_id} value={c.club_id}>{c.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => currentClubId && fetchPlayers(currentClubId)}
                            title="Refresh player list"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Step 1: Selection */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
                        Select Players
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Player {i + 1} {i < 2 ? '(Team 1)' : '(Team 2)'}
                                </label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={selectedPlayers[i]?.player_id || ''}
                                    onChange={(e) => handleSelectPlayer(i, e.target.value)}
                                >
                                    <option value="">Choose player...</option>
                                    {filteredPlayers.map(p => (
                                        <option key={p.player_id} value={p.player_id}>
                                            {p.name} ({p.declared_skill_level})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={handleFormMatch}
                            disabled={isLoading || selectedPlayers.some(p => p === null)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isLoading ? 'Creating Match...' : 'Form Match (Step 1)'}
                        </button>

                        {currentMatch && (
                            <button
                                onClick={handleTriggerFeedback}
                                disabled={feedbackLoading}
                                className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
                            >
                                {feedbackLoading ? 'Sending...' : 'Trigger Feedback SMS (Step 2)'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Match Info Banner */}
                {currentMatch && (
                    <div className="bg-indigo-600 rounded-xl shadow-md p-4 mb-8 text-white flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Active Simulated Match</p>
                                <p className="font-bold">STATUS: {currentMatch.status.toUpperCase()}</p>
                            </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                            <button onClick={() => {
                                fetch(`/api/matches/${currentMatch.match_id}`).then(r => r.json()).then(d => setCurrentMatch(d.match))
                            }} className="p-1 hover:bg-white/10 rounded" title="Refresh match status">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <div>
                                <p className="text-xs opacity-80">Match ID</p>
                                <p className="font-mono text-sm">{currentMatch.match_id.split('-')[0]}...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4-Way Phone Simulation */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {selectedPlayers.map((player, i) => (
                        <div key={i} className="flex flex-col h-[500px]">
                            {player ? (
                                <PlayerColumn
                                    player={{
                                        player_id: player.player_id,
                                        name: i === 0 ? `${player.name} (Originator)` : player.name,
                                        phone_number: player.phone_number
                                    }}
                                    messages={conversations[player.player_id] || []}
                                    onSendMessage={(msg) => handlePlayerReply(player.player_id, msg)}
                                />
                            ) : (
                                <div className="border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center h-full bg-gray-50/50">
                                    <p className="text-gray-400 text-sm italic">Select Player {i + 1}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-800 text-sm">
                    <p className="font-bold mb-1">How to test:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                        <li>Select 4 players and click <strong>Form Match</strong>.</li>
                        <li>In <strong>Player 1's Phone</strong>, type: <i>"We won 6-3 6-4"</i> or <i>"Billy and I won"</i>.</li>
                        <li>Verify the <strong>Status</strong> above changes to COMPLETED.</li>
                        <li>Click <strong>Trigger Feedback SMS</strong>.</li>
                        <li>In each phone, reply with scores like <i>"8 9 9"</i>.</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
