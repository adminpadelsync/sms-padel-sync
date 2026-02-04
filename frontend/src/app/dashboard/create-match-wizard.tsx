'use client'

import { useState, useEffect } from 'react'
import { searchPlayers } from './search-players'
import { formatLocalizedTime } from '@/utils/time-utils'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
    adjusted_skill_level?: number
    gender?: string
    match_score?: number
    club_id?: string
}

interface MatchWizardProps {
    isOpen: boolean
    onClose: () => void
    clubId: string
    clubTimezone?: string | null
    initialSelectedPlayers?: Player[]
}

const DEFAULT_PLAYERS: Player[] = []

export function MatchWizard({ isOpen, onClose, clubId, clubTimezone, initialSelectedPlayers = DEFAULT_PLAYERS }: MatchWizardProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const isQuickMode = initialSelectedPlayers.length > 0
    const totalSteps = isQuickMode ? 2 : 3

    // Step 1: Configuration
    const [config, setConfig] = useState({
        target_level: 3.5,
        gender_preference: 'mixed',
        scheduled_time: '',
        initial_player_ids: [] as string[], // Players already committed to the match
        direct_assignment: false, // Manual match assignment by admin
    })

    // Player search for initial players
    const [playerSearchTerm, setPlayerSearchTerm] = useState('')
    const [playerSearchResults, setPlayerSearchResults] = useState<Player[]>([])
    const [selectedInitialPlayers, setSelectedInitialPlayers] = useState<Player[]>([])

    // Step 2: Selection
    const [recommendations, setRecommendations] = useState<Player[]>([])
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])

    // Initialize with passed players
    useEffect(() => {
        if (isOpen && initialSelectedPlayers.length > 0) {
            setSelectedPlayers(initialSelectedPlayers.map(p => p.player_id))
        } else {
            setSelectedPlayers([])
        }
    }, [isOpen, initialSelectedPlayers])

    // Player search depends on clubId
    useEffect(() => {
        if (clubId && playerSearchTerm.length >= 2) {
            searchPlayers(clubId, playerSearchTerm).then(results => setPlayerSearchResults(results as Player[]))
        } else {
            setPlayerSearchResults([])
        }
    }, [playerSearchTerm, clubId])

    const handleAddInitialPlayer = (player: Player) => {
        if (!selectedInitialPlayers.find(p => p.player_id === player.player_id)) {
            setSelectedInitialPlayers([...selectedInitialPlayers, player])
            setConfig(prev => ({ ...prev, initial_player_ids: [...prev.initial_player_ids, player.player_id] }))
            setPlayerSearchTerm('')
            setPlayerSearchResults([])
        }
    }

    const handleRemoveInitialPlayer = (playerId: string) => {
        setSelectedInitialPlayers(selectedInitialPlayers.filter(p => p.player_id !== playerId))
        setConfig(prev => ({ ...prev, initial_player_ids: prev.initial_player_ids.filter(id => id !== playerId) }))
    }

    const handleNext = async () => {
        if (step === 1) {
            if (!clubId) {
                alert('Please select a club')
                return
            }

            // Quick Mode or Direct Assignment skips recommendations
            if (initialSelectedPlayers.length > 0 || config.direct_assignment) {
                setStep(3)
                return
            }

            setLoading(true)
            try {
                const { authFetch } = await import('@/utils/auth-fetch')
                const response = await authFetch('/api/recommendations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        club_id: clubId,
                        target_level: config.target_level,
                        gender_preference: config.gender_preference === 'mixed' ? null : config.gender_preference,
                        exclude_player_ids: config.initial_player_ids
                    })
                })

                if (!response.ok) throw new Error('Failed to fetch recommendations')
                const data = await response.json()
                setRecommendations(data.players)
                setStep(2)
            } catch (error) {
                console.error(error)
                alert('Error fetching recommendations')
            } finally {
                setLoading(false)
            }
        } else if (step === 2) {
            setStep(3)
        }
    }

    const handleSendInvites = async () => {
        setLoading(true)
        try {
            const { authFetch } = await import('@/utils/auth-fetch')
            const response = await authFetch('/api/outreach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    club_id: clubId,
                    player_ids: selectedPlayers,
                    scheduled_time: config.scheduled_time,
                    initial_player_ids: config.initial_player_ids,
                    direct_assignment: config.direct_assignment
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(errorText || 'Failed to process request')
            }

            alert(config.direct_assignment ? 'Match created successfully!' : 'Invites sent successfully!')
            onClose()
            window.location.reload()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : 'Error processing request')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Create Match - Step {isQuickMode && step === 3 ? 2 : step} of {totalSteps}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            {initialSelectedPlayers.length === 0 ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Target Level</label>
                                            <select
                                                disabled={config.direct_assignment}
                                                value={config.target_level}
                                                onChange={(e) => setConfig({ ...config, target_level: parseFloat(e.target.value) })}
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-50"
                                            >
                                                {[2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(l => (
                                                    <option key={l} value={l}>{l}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender Preference</label>
                                            <select
                                                disabled={config.direct_assignment}
                                                value={config.gender_preference}
                                                onChange={(e) => setConfig({ ...config, gender_preference: e.target.value })}
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-50"
                                            >
                                                <option value="mixed">Mixed (Any)</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {config.direct_assignment ? 'Confirmed Players' : 'Starting Players (Optional)'}
                                        </label>
                                        <p className="text-xs text-gray-500 mb-2">
                                            {config.direct_assignment
                                                ? "Exactly 4 players required for manual assignment"
                                                : "Add 1-3 players who are already committed to this match"}
                                        </p>

                                        {selectedInitialPlayers.length > 0 && (
                                            <div className="mb-2 space-y-1">
                                                {selectedInitialPlayers.map((player, idx) => (
                                                    <div key={player.player_id} className="flex items-center justify-between bg-indigo-50 px-3 py-2 rounded">
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {player.name}
                                                            {config.direct_assignment && idx === 0 && (
                                                                <span className="ml-2 text-xs font-normal text-indigo-600">(Originator)</span>
                                                            )}
                                                        </span>
                                                        <button
                                                            onClick={() => handleRemoveInitialPlayer(player.player_id)}
                                                            className="text-red-600 hover:text-red-800 text-sm"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {selectedInitialPlayers.length < (config.direct_assignment ? 4 : 3) && (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search by name or phone..."
                                                    value={playerSearchTerm}
                                                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                                                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                                                />

                                                {playerSearchResults.length > 0 && (
                                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                        {playerSearchResults.map(player => (
                                                            <button
                                                                key={player.player_id}
                                                                onClick={() => handleAddInitialPlayer(player)}
                                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                                            >
                                                                <div className="font-medium text-sm">{player.name}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    Level {(player.adjusted_skill_level || player.declared_skill_level).toFixed(2)} • {player.phone_number}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Selected Players ({initialSelectedPlayers.length})
                                    </label>
                                    <div className="bg-gray-50 rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                        {initialSelectedPlayers.map(player => (
                                            <div key={player.player_id} className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-gray-900">{player.name}</span>
                                                <span className="text-gray-500">Level {(player.adjusted_skill_level || player.declared_skill_level).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center space-x-2 py-3 border-t border-b border-gray-100">
                                <input
                                    type="checkbox"
                                    id="directAssignment"
                                    checked={config.direct_assignment}
                                    onChange={(e) => setConfig({ ...config, direct_assignment: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="directAssignment" className="text-sm font-medium text-gray-900">
                                    Manual Match Assignment (No invites, 4 players required)
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="date"
                                        value={config.scheduled_time ? config.scheduled_time.split('T')[0] : ''}
                                        onChange={(e) => {
                                            const date = e.target.value
                                            const time = config.scheduled_time ? config.scheduled_time.split('T')[1]?.substring(0, 5) : '08:00'
                                            setConfig({ ...config, scheduled_time: `${date}T${time}` })
                                        }}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                                        required
                                    />
                                    <select
                                        value={config.scheduled_time ? config.scheduled_time.split('T')[1]?.substring(0, 5) : '08:00'}
                                        onChange={(e) => {
                                            const date = config.scheduled_time ? config.scheduled_time.split('T')[0] : new Date().toISOString().split('T')[0]
                                            setConfig({ ...config, scheduled_time: `${date}T${e.target.value}` })
                                        }}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                                        required
                                    >
                                        {Array.from({ length: 33 }).map((_, i) => {
                                            const hour = Math.floor(i / 2) + 6
                                            const minute = (i % 2) * 30
                                            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                                            return (
                                                <option key={timeString} value={timeString}>
                                                    {new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <p className="mb-4 text-sm text-gray-600">Select players to invite ({selectedPlayers.length} selected)</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                                {recommendations.map(player => (
                                    <div key={player.player_id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedPlayers.includes(player.player_id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedPlayers([...selectedPlayers, player.player_id])
                                                } else {
                                                    setSelectedPlayers(selectedPlayers.filter(id => id !== player.player_id))
                                                }
                                            }}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-gray-900">{player.name}</p>
                                            <p className="text-xs text-gray-500">Level: {(player.adjusted_skill_level || player.declared_skill_level).toFixed(2)} • {player.gender || 'Unknown'}</p>
                                        </div>
                                    </div>
                                ))}
                                {recommendations.length === 0 && <p className="text-center text-gray-500 py-4">No matching players found.</p>}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">
                                {config.direct_assignment ? 'Confirm Match Assignment' : 'Ready to send invites?'}
                            </h3>
                            <div className="mt-4 max-w-sm mx-auto text-left bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-2">
                                    {config.direct_assignment
                                        ? 'The following 4 players will be added to the match and receive a confirmation SMS immediately:'
                                        : 'You are sending invites to:'}
                                </p>
                                <ul className="space-y-1 mb-4">
                                    {(config.direct_assignment || initialSelectedPlayers.length > 0
                                        ? selectedInitialPlayers
                                        : recommendations.filter(p => selectedPlayers.includes(p.player_id))
                                    ).map((p, idx) => (
                                        <li key={p.player_id} className="text-sm font-medium text-gray-900 flex justify-between">
                                            <span>
                                                {p.name}
                                                {config.direct_assignment && idx === 0 && (
                                                    <span className="ml-2 text-xs font-normal text-indigo-600">(Originator)</span>
                                                )}
                                            </span>
                                            <span className="text-gray-500 text-xs">Level {(p.adjusted_skill_level || p.declared_skill_level).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-sm text-gray-600 border-t border-gray-200 pt-2">
                                    Scheduled for: <br />
                                    <span className="font-semibold text-gray-900">
                                        {config.scheduled_time ? formatLocalizedTime(config.scheduled_time, clubTimezone || undefined, false) : ''}
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-between rounded-b-lg">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(isQuickMode && step === 3 ? 1 : step - 1)}
                            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Back
                        </button>
                    )}
                    <div className="ml-auto">
                        {step < 3 ? (
                            <button
                                onClick={handleNext}
                                disabled={
                                    loading ||
                                    (step === 1 && !config.scheduled_time) ||
                                    (step === 1 && config.direct_assignment && selectedInitialPlayers.length !== 4)
                                }
                                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Next'}
                            </button>
                        ) : (
                            <button
                                onClick={handleSendInvites}
                                disabled={loading}
                                className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white disabled:opacity-50 ${config.direct_assignment ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                {loading ? 'Processing...' : (config.direct_assignment ? 'Confirm Match' : 'Create Match')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
