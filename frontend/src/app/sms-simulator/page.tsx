'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlayerColumn } from './player-column'
import { ClubSettingsPanel } from './club-settings-panel'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
}

interface Message {
    id: string
    from: 'system' | 'player'
    text: string
    timestamp: Date
}

interface Match {
    id: string
    number: number
    time: string
    date: string
    court: string
    confirmedPlayerIds: string[]
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
    player_names: string[]
}

interface Club {
    club_id: string
    name: string
    phone_number: string
}

export default function SMSSimulatorPage() {
    const [players, setPlayers] = useState<Player[]>([])
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([])
    const [conversations, setConversations] = useState<Record<string, Message[]>>({})
    const [matches, setMatches] = useState<Match[]>([]) // All matches
    const [playerMatches, setPlayerMatches] = useState<Record<string, number[]>>({}) // player_id -> match numbers
    const [loading, setLoading] = useState(false)
    const [nextMatchNumber, setNextMatchNumber] = useState(1)
    const [testMode, setTestMode] = useState(true) // Default to test mode
    const [confirmedMatches, setConfirmedMatches] = useState<ConfirmedMatch[]>([])
    const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null)
    const [currentClubId, setCurrentClubId] = useState<string | null>(null)
    const [clubs, setClubs] = useState<Club[]>([])
    // Track selected club per player (player_id -> club_id)
    const [playerClubSelection, setPlayerClubSelection] = useState<Record<string, string>>({})

    // Fetch players, clubs, and confirmed matches on mount
    useEffect(() => {
        fetchPlayers()
        fetchClubs()
        fetchConfirmedMatches()
    }, [])

    // Poll for outbox messages when in test mode
    useEffect(() => {
        if (!testMode || selectedPlayers.length === 0) return

        const pollOutbox = async () => {
            try {
                const response = await fetch('/api/sms-outbox')
                if (response.ok) {
                    const data = await response.json()
                    const messages: OutboxMessage[] = data.messages || []

                    // Group messages by phone number and add to conversations
                    for (const msg of messages) {
                        const player = selectedPlayers.find(p => p.phone_number === msg.to_number)
                        if (player) {
                            const newMessage: Message = {
                                id: msg.id,
                                from: 'system',
                                text: msg.body,
                                timestamp: new Date(msg.created_at)
                            }

                            setConversations(prev => {
                                const existing = prev[player.player_id] || []
                                // Avoid duplicates
                                if (existing.some(m => m.id === msg.id)) return prev
                                return {
                                    ...prev,
                                    [player.player_id]: [...existing, newMessage]
                                }
                            })

                            // Mark as read
                            await fetch(`/api/sms-outbox/${msg.id}/read`, { method: 'POST' })
                        }
                    }
                }
            } catch (error) {
                console.error('Error polling outbox:', error)
            }
        }

        // Poll every 2 seconds
        const interval = setInterval(pollOutbox, 2000)
        pollOutbox() // Initial poll

        return () => clearInterval(interval)
    }, [testMode, selectedPlayers])

    const fetchPlayers = async () => {
        try {
            const response = await fetch('/api/players')
            if (response.ok) {
                const data = await response.json()
                setPlayers(data.players || [])
            }
        } catch (error) {
            console.error('Error fetching players:', error)
        }
    }

    const fetchClubs = async () => {
        try {
            const response = await fetch('/api/clubs')
            if (response.ok) {
                const data = await response.json()
                const clubList = data.clubs || []
                setClubs(clubList)
                // Set default club for currentClubId if not already set
                if (clubList.length > 0 && !currentClubId) {
                    setCurrentClubId(clubList[0].club_id)
                }
            }
        } catch (error) {
            console.error('Error fetching clubs:', error)
        }
    }

    const fetchConfirmedMatches = async () => {
        try {
            // Try to get club_id, but fetch matches even if we can't
            let clubId = null
            try {
                const clubResponse = await fetch('/api/clubs')
                if (clubResponse.ok) {
                    const clubData = await clubResponse.json()
                    clubId = clubData.clubs?.[0]?.club_id
                    if (clubId) {
                        setCurrentClubId(clubId)
                    }
                }
            } catch {
                // Club fetch failed, continue without club filter
            }

            // Fetch matches - with or without club filter
            const url = clubId
                ? `/api/matches/confirmed?club_id=${clubId}`
                : '/api/matches/confirmed'

            const response = await fetch(url)
            if (response.ok) {
                const data = await response.json()
                setConfirmedMatches(data.matches || [])
            }
        } catch (error) {
            console.error('Error fetching confirmed matches:', error)
        }
    }


    const handleSendFeedback = async (matchId: string) => {
        setFeedbackLoading(matchId)
        try {
            const response = await fetch(`/api/matches/${matchId}/feedback`, {
                method: 'POST'
            })
            if (response.ok) {
                const data = await response.json()
                alert(`Feedback SMS sent to ${data.sms_sent} players!`)
                fetchConfirmedMatches() // Refresh list
            } else {
                const error = await response.json()
                alert(`Error: ${error.detail || 'Failed to send feedback'}`)
            }
        } catch (error) {
            console.error('Error sending feedback:', error)
            alert('Failed to send feedback SMS')
        } finally {
            setFeedbackLoading(null)
        }
    }


    const handleSelectPlayer = (playerId: string) => {
        const player = players.find(p => p.player_id === playerId)
        if (player && selectedPlayers.length < 6 && !selectedPlayers.find(p => p.player_id === playerId)) {
            setSelectedPlayers([...selectedPlayers, player])
            setConversations({
                ...conversations,
                [player.player_id]: []
            })
        }
    }

    const handleRemovePlayer = (playerId: string) => {
        setSelectedPlayers(selectedPlayers.filter(p => p.player_id !== playerId))
        const newConversations = { ...conversations }
        delete newConversations[playerId]
        setConversations(newConversations)
    }

    const handleSendMatchInvite = async () => {
        if (selectedPlayers.length < 4) {
            alert('Please select at least 4 players')
            return
        }

        setLoading(true)
        try {
            // Get tomorrow's date for the match
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            tomorrow.setHours(15, 0, 0, 0) // 3:00 PM
            const dateStr = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

            // Get club_id from current club or first player
            const clubId = currentClubId || selectedPlayers[0]?.player_id?.split('-')[0] || 'default'

            // Create a REAL match in the database via API
            const response = await fetch('/api/outreach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    club_id: clubId,
                    player_ids: selectedPlayers.map(p => p.player_id),
                    scheduled_time: tomorrow.toISOString(),
                    initial_player_ids: []
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create match')
            }

            const data = await response.json()
            const realMatchId = data.match?.match_id

            // Create local match for UI simulation
            const newMatch: Match = {
                id: realMatchId || `match_${Date.now()}`,
                number: nextMatchNumber,
                time: '3:00 PM',
                date: `Tomorrow (${dateStr})`,
                court: 'Court 2',
                confirmedPlayerIds: []
            }

            // Add match to matches list
            setMatches(prev => [...prev, newMatch])

            // Assign match number to each player
            const newPlayerMatches = { ...playerMatches }
            selectedPlayers.forEach(player => {
                if (!newPlayerMatches[player.player_id]) {
                    newPlayerMatches[player.player_id] = []
                }
                newPlayerMatches[player.player_id].push(newMatch.number)
            })
            setPlayerMatches(newPlayerMatches)

            // Refresh confirmed matches list after a short delay to pick up the new match
            setTimeout(() => fetchConfirmedMatches(), 1000)

            // Send invite messages (local simulation only if not in test mode)
            if (!testMode) {
                const newConversations = { ...conversations }
                selectedPlayers.forEach(player => {
                    // Check how many pending invites this player will have
                    const playerPendingMatches = newPlayerMatches[player.player_id] || []
                    const hasSingleInvite = playerPendingMatches.length === 1

                    let inviteMessage = ''
                    if (hasSingleInvite) {
                        // Simple YES/NO for first invite
                        inviteMessage = `🎾 Match invite!
📅 ${newMatch.date} ${newMatch.time}
🏟️ ${newMatch.court}

Reply YES to join, NO to decline`
                    } else {
                        // Numbered format for multiple invites - show ALL pending matches
                        inviteMessage = `🎾 You have ${playerPendingMatches.length} match invites:\n\n`

                        // List all pending matches for this player
                        const allPlayerMatches = matches
                            .concat([newMatch]) // Include the new match
                            .filter(m => playerPendingMatches.includes(m.number))
                            .sort((a, b) => a.number - b.number)

                        allPlayerMatches.forEach(m => {
                            const confirmedCount = m.confirmedPlayerIds.length
                            const confirmedNames = m.confirmedPlayerIds
                                .map(id => {
                                    const p = selectedPlayers.find(sp => sp.player_id === id)
                                    return p ? `${p.name} (${p.declared_skill_level})` : 'Unknown'
                                })
                                .join(', ')

                            inviteMessage += `${m.number} - ${m.date} ${m.time} (${confirmedCount}/4)\n`
                            if (confirmedNames) {
                                inviteMessage += `    ${confirmedNames}\n`
                            }
                            inviteMessage += '\n'
                        })

                        inviteMessage += `Reply with match numbers to join\nExamples: 1 or 1 2 or 1 2 3`
                    }

                    const message: Message = {
                        id: Date.now().toString() + player.player_id,
                        from: 'system',
                        text: inviteMessage,
                        timestamp: new Date()
                    }
                    newConversations[player.player_id] = [
                        ...(newConversations[player.player_id] || []),
                        message
                    ]
                })
                setConversations(newConversations)
            }

            // Increment match number for next invite
            setNextMatchNumber(prev => prev + 1)

        } catch (error) {
            console.error('Error sending invites:', error)
            alert('Failed to send invites')
        } finally {
            setLoading(false)
        }
    }

    const handlePlayerMessage = async (playerId: string, messageText: string) => {
        const player = selectedPlayers.find(p => p.player_id === playerId)
        if (!player) return

        const message: Message = {
            id: Date.now().toString(),
            from: 'player',
            text: messageText,
            timestamp: new Date()
        }

        setConversations(prev => ({
            ...prev,
            [playerId]: [...(prev[playerId] || []), message]
        }))

        // Test mode: POST to backend, response will come via outbox polling
        if (testMode) {
            try {
                // Get the selected club for this player, or default to first club
                const selectedClubId = playerClubSelection[playerId] || clubs[0]?.club_id
                const selectedClub = clubs.find(c => c.club_id === selectedClubId)
                const toNumber = selectedClub?.phone_number

                await fetch('/api/sms-inbox', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from_number: player.phone_number,
                        body: messageText,
                        to_number: toNumber
                    })
                })
            } catch (error) {
                console.error('Error sending to inbox:', error)
            }
            return
        }

        // Local simulation mode (fallback)
        setTimeout(() => {
            let responseText = ''
            const upperMessage = messageText.toUpperCase().trim()

            // Get player's pending matches
            const playerMatchNumbers = playerMatches[playerId] || []
            const playerPendingMatches = matches.filter(m =>
                playerMatchNumbers.includes(m.number) && !m.confirmedPlayerIds.includes(playerId)
            )

            // Check for space-separated numbers (e.g., "1", "1 2", "1 2 3")
            const numbersMatch = upperMessage.match(/^[\d\s]+$/)

            if (numbersMatch) {
                // Parse space-separated match numbers
                const matchNums = upperMessage.trim().split(/\s+/).map(n => parseInt(n)).filter(n => !isNaN(n))

                if (matchNums.length === 0) {
                    responseText = '❌ Please provide match numbers (i.e. 1 or 1 2)'
                } else {
                    // Join all specified matches
                    const results: string[] = []
                    let joinedCount = 0

                    matchNums.forEach(matchNum => {
                        const match = matches.find(m => m.number === matchNum)
                        const playerMatchNums = playerMatches[playerId] || []

                        if (!match || !playerMatchNums.includes(matchNum)) {
                            results.push(`❌ Match #${matchNum} not found`)
                        } else if (match.confirmedPlayerIds.includes(playerId)) {
                            results.push(`✅ Already joined #${matchNum}`)
                        } else if (match.confirmedPlayerIds.length >= 4) {
                            results.push(`❌ Match #${matchNum} is full (4/4)`)
                        } else {
                            // Add player to match
                            setMatches(prev => prev.map(m =>
                                m.number === matchNum
                                    ? { ...m, confirmedPlayerIds: [...m.confirmedPlayerIds, playerId] }
                                    : m
                            ))
                            const newCount = match.confirmedPlayerIds.length + 1
                            results.push(`✅ Joined #${matchNum} (${newCount}/4)`)
                            joinedCount++
                        }
                    })

                    responseText = results.join('\n')
                    if (joinedCount > 0) {
                        responseText += `\n\nReply MATCHES to see all your matches`
                    }
                }
            } else if (upperMessage === 'YES' || upperMessage === 'Y') {
                // Simple YES for single pending match
                if (playerPendingMatches.length === 0) {
                    responseText = '❌ No pending match invites. Reply MATCHES to see your matches.'
                } else if (playerPendingMatches.length === 1) {
                    // Join the single pending match
                    const match = playerPendingMatches[0]
                    if (match.confirmedPlayerIds.length >= 4) {
                        responseText = `❌ Sorry, this match is full (4/4). We'll let you know about the next one!`
                    } else {
                        setMatches(prev => prev.map(m =>
                            m.number === match.number
                                ? { ...m, confirmedPlayerIds: [...m.confirmedPlayerIds, playerId] }
                                : m
                        ))
                        const newCount = match.confirmedPlayerIds.length + 1
                        if (newCount >= 4) {
                            responseText = `✅ Joined! Match confirmed (4/4) 🎾`
                        } else {
                            responseText = `✅ Great! You're in. (${newCount}/4 confirmed)`
                        }
                    }
                } else {
                    // Multiple pending - need to specify which one
                    responseText = `You have ${playerPendingMatches.length} pending invites. Reply with match numbers to join (i.e. 1 or 1 2)`
                }
            } else if (upperMessage === 'NO' || upperMessage === 'N') {
                // NO is optional - just for politeness
                responseText = '❌ No problem! No need to reply if you can\'t make it.'
            } else if (upperMessage === 'MATCHES') {
                // Show all matches for this player
                const playerMatchNumbers = playerMatches[playerId] || []
                const playerMatchList = matches.filter(m => playerMatchNumbers.includes(m.number))

                if (playerMatchList.length === 0) {
                    responseText = '📅 You have no match invites. Check back later!'
                } else {
                    const confirmed = playerMatchList.filter(m => m.confirmedPlayerIds.length >= 4)
                    const pending = playerMatchList.filter(m => m.confirmedPlayerIds.length < 4)

                    let matchText = '📅 Your matches:\n\n'

                    if (confirmed.length > 0) {
                        matchText += 'CONFIRMED:\n'
                        confirmed.forEach(m => {
                            const playerNames = m.confirmedPlayerIds
                                .map(id => {
                                    const p = selectedPlayers.find(sp => sp.player_id === id)
                                    return p ? `${p.name} (${p.declared_skill_level})` : 'Unknown'
                                })
                                .join(', ')
                            matchText += `#${m.number} - ${m.date} ${m.time} ✅ (4/4)\n     ${playerNames}\n\n`
                        })
                    }

                    if (pending.length > 0) {
                        matchText += 'PENDING:\n'
                        pending.forEach(m => {
                            const count = m.confirmedPlayerIds.length
                            const playerNames = m.confirmedPlayerIds
                                .map(id => {
                                    const p = selectedPlayers.find(sp => sp.player_id === id)
                                    return p ? `${p.name} (${p.declared_skill_level})` : 'Unknown'
                                })
                                .join(', ')
                            const joined = m.confirmedPlayerIds.includes(playerId)
                            matchText += `#${m.number} - ${m.date} ${m.time} (${count}/4)\n`
                            if (playerNames) {
                                matchText += `     ${playerNames}\n`
                            }
                            if (!joined) {
                                matchText += `     Reply ${m.number} to join\n`
                            }
                            matchText += '\n'
                        })
                    }

                    matchText += 'Reply with match numbers (i.e. 1 or 1 2)'
                    responseText = matchText
                }
            } else if (upperMessage === 'HELP' || upperMessage === '?') {
                responseText = `🎾 PADEL SYNC

MATCH RESPONSES:
• Reply # to join (i.e. 1 or 1 2 3)
• YES - Join single pending match
• MAYBE - Tentative response
• CANCEL # - Cancel match (i.e. CANCEL 1)

MATCH INFO:
• MATCHES - View all your matches
• NEXT - Next confirmed match details
• STATUS - Check match status

MATCH REQUESTS:
• PLAY [when] - Request a match
  Example: PLAY tomorrow 6pm

AVAILABILITY:
• AVAILABLE - View/update availability

FEEDBACK:
• RATE [name] [1-5] - Rate a player
  Example: RATE John 5

Reply HELP anytime • Reply STOP to opt out`
            } else if (upperMessage.startsWith('PLAY')) {
                // PLAY [when] - Request a match
                const whenPart = messageText.substring(4).trim()
                if (whenPart) {
                    responseText = `🎾 Match request received for "${whenPart}"!

We'll find players at your skill level and send invites. You'll get a text when players respond.

Reply MATCHES to track your invites.`
                } else {
                    responseText = `🎾 When would you like to play?

Reply: PLAY [when]
Examples:
• PLAY tomorrow 6pm
• PLAY Saturday morning
• PLAY Dec 15 3pm

We'll find players and send invites!`
                }
            } else if (upperMessage === 'AVAILABLE') {
                // AVAILABLE - Set/view availability
                responseText = `📅 Your current availability:
Weekdays after 6pm, Weekends anytime

To update, reply:
AVAILABLE [new schedule]

Example: AVAILABLE Mon/Wed 7pm, Sat mornings`
            } else if (upperMessage.startsWith('RATE ')) {
                // RATE [player] [score] - Post-match feedback
                const rateParts = messageText.substring(5).trim().split(' ')
                if (rateParts.length >= 2) {
                    const score = rateParts[rateParts.length - 1]
                    const playerName = rateParts.slice(0, -1).join(' ')
                    const scoreNum = parseInt(score)

                    if (scoreNum >= 1 && scoreNum <= 5) {
                        responseText = `⭐ Thanks for rating ${playerName}!

Your feedback (${scoreNum}/5) helps us make better matches.

Rate more players anytime after a match.`
                    } else {
                        responseText = `❌ Please use a rating from 1-5

Example: RATE John 5`
                    }
                } else {
                    responseText = `❌ Please include player name and rating

Format: RATE [name] [1-5]
Example: RATE Sarah 4`
                }
            } else if (upperMessage === 'NEXT') {
                // NEXT - Next match details
                const playerMatchNumbers = playerMatches[playerId] || []
                const confirmedMatches = matches
                    .filter(m => playerMatchNumbers.includes(m.number) && m.confirmedPlayerIds.length >= 4)
                    .sort((a, b) => a.number - b.number)

                if (confirmedMatches.length > 0) {
                    const nextMatch = confirmedMatches[0]
                    const playerNames = nextMatch.confirmedPlayerIds
                        .map(id => {
                            const p = selectedPlayers.find(sp => sp.player_id === id)
                            return p ? `${p.name} (${p.declared_skill_level})` : 'Unknown'
                        })
                        .join(', ')

                    responseText = `🎾 Your next match:

📅 ${nextMatch.date} ${nextMatch.time}
🏟️ ${nextMatch.court}
👥 ${playerNames}

See you on the court! 🎾`
                } else {
                    responseText = `📅 No confirmed matches yet.

Reply MATCHES to see pending invites or PLAY to request a match!`
                }
            } else if (upperMessage === 'MAYBE') {
                // MAYBE - Tentative response
                if (playerPendingMatches.length === 0) {
                    responseText = '❌ No pending match invites. Reply MATCHES to see your matches.'
                } else if (playerPendingMatches.length === 1) {
                    const match = playerPendingMatches[0]
                    responseText = `🤔 Marked as MAYBE for match #${match.number}

We'll check back closer to ${match.date} ${match.time}.

Reply ${match.number} to confirm or CANCEL ${match.number} to decline.`
                } else {
                    responseText = `You have ${playerPendingMatches.length} pending invites.

Reply MAYBE # to mark specific match
Example: MAYBE 1`
                }
            } else if (upperMessage.startsWith('CANCEL ')) {
                // Cancel a specific match
                const matchNum = parseInt(upperMessage.replace('CANCEL ', ''))
                if (isNaN(matchNum)) {
                    responseText = '❌ Please specify match number (i.e. CANCEL 1)'
                } else {
                    const match = matches.find(m => m.number === matchNum)
                    if (!match || !match.confirmedPlayerIds.includes(playerId)) {
                        responseText = `❌ You haven't joined match #${matchNum}`
                    } else {
                        setMatches(prev => prev.map(m =>
                            m.number === matchNum
                                ? { ...m, confirmedPlayerIds: m.confirmedPlayerIds.filter(id => id !== playerId) }
                                : m
                        ))
                        responseText = `❌ Cancelled match #${matchNum}. We'll notify the other players.`
                    }
                }
            } else if (upperMessage === 'STATUS') {
                // Show all confirmed players across all matches
                responseText = '📊 Use MATCHES to see your match invites with player details.'
            } else if (['1', '2', '3'].includes(upperMessage)) {
                responseText = `✅ Got it! You voted for option ${upperMessage}.`
            } else {
                responseText = 'I didn\'t understand that. Reply HELP for available commands.'
            }

            const systemMessage: Message = {
                id: Date.now().toString() + '-system',
                from: 'system',
                text: responseText,
                timestamp: new Date()
            }

            setConversations(prev => ({
                ...prev,
                [playerId]: [...(prev[playerId] || []), systemMessage]
            }))
        }, 500)
    }

    const handleReset = () => {
        if (confirm('Reset all conversations and matches?')) {
            setConversations({})
            setMatches([])
            setPlayerMatches({})
            setNextMatchNumber(1)
            selectedPlayers.forEach(player => {
                setConversations(prev => ({
                    ...prev,
                    [player.player_id]: []
                }))
            })
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">SMS Testing Simulator</h1>
                        {testMode && (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                🔗 Backend Connected
                            </span>
                        )}
                    </div>
                    <p className="text-gray-600">Test SMS match flow with simulated player responses</p>
                </div>

                {/* Controls */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Test Mode Toggle */}
                        <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
                            <label className="text-sm font-medium text-gray-700">Mode:</label>
                            <button
                                onClick={() => setTestMode(!testMode)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${testMode
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {testMode ? '🔗 Test Mode (Backend)' : '💻 Local Mode'}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">Add Player:</label>
                            <select
                                onChange={(e) => handleSelectPlayer(e.target.value)}
                                value=""
                                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={selectedPlayers.length >= 6}
                            >
                                <option value="">Select player...</option>
                                {players
                                    .filter(p => !selectedPlayers.find(sp => sp.player_id === p.player_id))
                                    .map(player => (
                                        <option key={player.player_id} value={player.player_id}>
                                            {player.name} - Level {player.declared_skill_level}
                                        </option>
                                    ))}
                            </select>
                            <span className="text-sm text-gray-500">
                                ({selectedPlayers.length}/6 selected)
                            </span>
                        </div>

                        <button
                            onClick={handleSendMatchInvite}
                            disabled={loading || selectedPlayers.length < 4}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            Send Match Invites
                        </button>

                        <button
                            onClick={handleReset}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                        >
                            Reset All
                        </button>
                    </div>
                </div>

                {/* Confirmed Matches Panel */}
                {testMode && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900">📋 Confirmed Matches (for Feedback Testing)</h2>
                            <button
                                onClick={fetchConfirmedMatches}
                                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                        {confirmedMatches.length === 0 ? (
                            <p className="text-gray-500 text-sm">No confirmed matches found. Create a match in the dashboard first.</p>
                        ) : (
                            <div className="space-y-2">
                                {confirmedMatches.map(match => {
                                    const date = new Date(match.scheduled_time)
                                    const dateStr = date.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    })
                                    return (
                                        <div key={match.match_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <div className="font-medium text-gray-900">{dateStr}</div>
                                                <div className="text-sm text-gray-600">
                                                    {match.player_names?.join(', ') || 'No players'}
                                                </div>
                                                {match.feedback_collected && (
                                                    <span className="text-xs text-green-600">✓ Feedback collected</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleSendFeedback(match.match_id)}
                                                disabled={feedbackLoading === match.match_id}
                                                className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                                            >
                                                {feedbackLoading === match.match_id ? 'Sending...' : '📨 Send Feedback SMS'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Club Settings Panel */}
                {testMode && currentClubId && (
                    <div className="mb-6">
                        <ClubSettingsPanel clubId={currentClubId} />
                    </div>
                )}

                {/* Player Columns */}
                {selectedPlayers.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <p className="text-gray-500">Select at least 4 players to start testing</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ height: '600px' }}>
                        {selectedPlayers.map(player => (
                            <div key={player.player_id} className="relative">
                                <button
                                    onClick={() => handleRemovePlayer(player.player_id)}
                                    className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center text-xs"
                                >
                                    ✕
                                </button>
                                <PlayerColumn
                                    player={player}
                                    messages={conversations[player.player_id] || []}
                                    onSendMessage={(msg) => handlePlayerMessage(player.player_id, msg)}
                                    clubs={clubs}
                                    selectedClubId={playerClubSelection[player.player_id] || clubs[0]?.club_id}
                                    onClubChange={(clubId) => setPlayerClubSelection(prev => ({
                                        ...prev,
                                        [player.player_id]: clubId
                                    }))}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
