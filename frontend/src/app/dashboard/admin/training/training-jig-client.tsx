"use client"

import { useState, useEffect, useRef } from 'react'
import {
    Send,
    CheckCircle2,
    XCircle,
    User,
    BrainCircuit,
    History,
    Save,
    RotateCcw,
    AlertCircle,
    ChevronRight,
    MessageSquare,
    Users,
    Zap,
    Trophy
} from 'lucide-react'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
}

interface Club {
    club_id: string
    name: string
}

interface Message {
    role: 'user' | 'assistant'
    text: string
    timestamp: Date
    intent?: string
    confidence?: number
    entities?: any
    reasoning?: string
    isCorrect?: boolean
    correction?: {
        intent: string
        text: string
    }
}

interface GoldenSample {
    name: string
    initial_state: string
    steps: any[]
}

export default function TrainingJigClient() {
    const [clubs, setClubs] = useState<Club[]>([])
    const [selectedClubId, setSelectedClubId] = useState<string>('')
    const [players, setPlayers] = useState<Player[]>([])
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
    const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
    const [conversations, setConversations] = useState<Record<string, Message[]>>({})
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [goldenSamples, setGoldenSamples] = useState<GoldenSample[]>([])
    const [showCorrectionModal, setShowCorrectionModal] = useState<{ pId: string, msgIdx: number } | null>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Correction Modal State
    const [correctedIntent, setCorrectedIntent] = useState('')
    const [correctedResponse, setCorrectedResponse] = useState('')

    useEffect(() => {
        fetchClubs()
        fetchGoldenSamples()
    }, [])

    useEffect(() => {
        if (selectedClubId) {
            fetchPlayers(selectedClubId)
        } else {
            setPlayers([])
        }
        // Reset state on club change
        setConversations({})
        setSelectedPlayerIds([])
        setActivePlayerId(null)
    }, [selectedClubId])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [conversations, activePlayerId])

    const fetchClubs = async () => {
        try {
            const response = await fetch('/api/clubs')
            if (response.ok) {
                const data = await response.json()
                const activeClubs = data.clubs || []
                setClubs(activeClubs)
                if (activeClubs.length > 0 && !selectedClubId) {
                    setSelectedClubId(activeClubs[0].club_id)
                }
            }
        } catch (error) {
            console.error('Error fetching clubs:', error)
        }
    }

    const fetchPlayers = async (clubId: string) => {
        try {
            const response = await fetch(`/api/players?club_id=${clubId}`)
            if (response.ok) {
                const data = await response.json()
                setPlayers(data.players || [])
            }
        } catch (error) {
            console.error('Error fetching players:', error)
        }
    }

    const fetchGoldenSamples = async () => {
        try {
            const res = await fetch('/api/training/golden-samples')
            const data = await res.json()
            if (data.samples) setGoldenSamples(data.samples)
        } catch (e) {
            console.error("Failed to fetch golden samples", e)
        }
    }

    const activeMessages = activePlayerId ? (conversations[activePlayerId] || []) : []
    const activePlayer = players.find(p => p.player_id === activePlayerId)

    const sendMessage = async (textOverride?: string) => {
        const msgText = textOverride || input
        if (!msgText.trim() || !activePlayerId || loading) return

        const userMsg: Message = {
            role: 'user',
            text: msgText,
            timestamp: new Date()
        }

        const currentMessages = conversations[activePlayerId] || []
        const newMessages = [...currentMessages, userMsg]

        setConversations(prev => ({
            ...prev,
            [activePlayerId]: newMessages
        }))

        if (!textOverride) setInput('')
        setLoading(true)

        try {
            const history = currentMessages.map(m => ({
                role: m.role,
                text: m.text
            }))

            const response = await fetch('/api/training/step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: activePlayerId,
                    club_id: selectedClubId,
                    message: msgText,
                    history: history,
                    golden_samples: goldenSamples.slice(0, 3)
                })
            })

            const data = await response.json()

            if (data.responses) {
                const assistantMsg: Message = {
                    role: 'assistant',
                    text: data.responses.map((r: any) => r.body).join('\n'),
                    timestamp: new Date(),
                    intent: data.intent,
                    confidence: data.confidence,
                    entities: data.entities,
                    reasoning: data.raw_reasoning
                }

                setConversations(prev => ({
                    ...prev,
                    [activePlayerId]: [...(prev[activePlayerId] || []), assistantMsg]
                }))
            }
        } catch (e) {
            console.error("Simulation failed", e)
        } finally {
            setLoading(false)
        }
    }

    const handleCorrection = (playerId: string, index: number) => {
        const msg = conversations[playerId][index]
        setCorrectedIntent(msg.intent || '')
        setCorrectedResponse(msg.text)
        setShowCorrectionModal({ pId: playerId, msgIdx: index })
    }

    const saveCorrection = () => {
        if (showCorrectionModal === null) return
        const { pId, msgIdx } = showCorrectionModal

        setConversations(prev => {
            const prevMsgs = prev[pId] || []
            const msgs = [...prevMsgs]
            msgs[msgIdx] = {
                ...msgs[msgIdx],
                isCorrect: false,
                correction: {
                    intent: correctedIntent,
                    text: correctedResponse
                }
            }
            return { ...prev, [pId]: msgs }
        })
        setShowCorrectionModal(null)
    }

    const markCorrect = (playerId: string, index: number) => {
        setConversations(prev => {
            const prevMsgs = prev[playerId] || []
            const msgs = [...prevMsgs]
            msgs[index] = { ...msgs[index], isCorrect: true }
            return { ...prev, [playerId]: msgs }
        })
    }

    const triggerEvent = async (type: string) => {
        if (!activePlayerId) return
        setLoading(true)
        try {
            const res = await fetch('/api/training/trigger-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: type,
                    match_id: "SIM_MATCH_123",
                    player_ids: selectedPlayerIds,
                    club_id: selectedClubId
                })
            })
            const data = await res.json()
            if (data.responses) {
                const newConversations = { ...conversations }
                data.responses.forEach((r: any) => {
                    const p = players.find(pl => pl.phone_number === r.to)
                    if (p && selectedPlayerIds.includes(p.player_id)) {
                        newConversations[p.player_id] = [
                            ...(newConversations[p.player_id] || []),
                            {
                                role: 'assistant',
                                text: r.body,
                                timestamp: new Date()
                            }
                        ]
                    }
                })
                setConversations(newConversations)
            }
        } catch (e) {
            console.error("Event trigger failed", e)
        } finally {
            setLoading(false)
        }
    }

    const saveToGoldenDataset = async () => {
        if (!activePlayerId || activeMessages.length === 0) return
        setSaving(true)

        try {
            const steps = []
            for (let i = 0; i < activeMessages.length; i++) {
                if (activeMessages[i].role === 'user') {
                    const nextAssistant = activeMessages[i + 1]
                    if (nextAssistant && nextAssistant.role === 'assistant') {
                        steps.push({
                            user_input: activeMessages[i].text,
                            expected_intent: nextAssistant.correction?.intent || nextAssistant.intent,
                            expected_response: nextAssistant.correction?.text || nextAssistant.text,
                            entities: nextAssistant.entities
                        })
                    }
                }
            }

            const res = await fetch('/api/training/correct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `Training Session - ${activePlayer?.name} - ${new Date().toLocaleDateString()}`,
                    initial_state: 'IDLE',
                    steps: steps
                })
            })

            if (res.ok) {
                alert("Saved to Golden Dataset!")
                fetchGoldenSamples()
            }
        } catch (e) {
            console.error("Failed to save", e)
        } finally {
            setSaving(false)
        }
    }

    const resetSession = () => {
        setConversations({})
        setInput('')
    }

    const togglePlayer = (pId: string) => {
        setSelectedPlayerIds(prev => {
            const next = prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
            if (next.length > 0 && !next.includes(activePlayerId || '')) {
                setActivePlayerId(next[0])
            } else if (next.length === 0) {
                setActivePlayerId(null)
            }
            return next
        })
    }

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900/50 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <BrainCircuit className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">AI Reasoner Training Jig</h1>
                        <p className="text-xs text-slate-400">Multi-player simulation & event testing</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-4">
                        <span className="text-xs font-bold text-slate-500 uppercase">Club</span>
                        <select
                            value={selectedClubId}
                            onChange={(e) => setSelectedClubId(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {clubs.map(c => (
                                <option key={c.club_id} value={c.club_id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={resetSession}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                        title="Reset All Sessions"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>

                    <button
                        onClick={saveToGoldenDataset}
                        disabled={saving || !activePlayerId || activeMessages.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {saving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Active to Golden
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Players Sidebar */}
                <div className="w-64 border-r border-slate-800 bg-slate-900/30 flex flex-col">
                    <div className="p-4 border-b border-slate-800">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Involved Players</h2>
                        </div>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                            {players.map(p => (
                                <div
                                    key={p.player_id}
                                    onClick={() => togglePlayer(p.player_id)}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedPlayerIds.includes(p.player_id)
                                        ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/30'
                                        : 'hover:bg-slate-800 text-slate-400 border border-transparent'
                                        }`}
                                >
                                    <span className="text-sm truncate">{p.name}</span>
                                    {selectedPlayerIds.includes(p.player_id) && <CheckCircle2 className="w-3 h-3" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-4 h-4 text-amber-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Simulation Tools</h2>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={() => sendMessage("I want to play a match this Friday at 6pm")}
                                disabled={!activePlayerId || loading}
                                className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-xs text-slate-400 transition-colors border border-slate-800/50"
                            >
                                Send: "Play Friday @ 6pm"
                            </button>
                            <button
                                onClick={() => sendMessage("Yes, count me in!")}
                                disabled={!activePlayerId || loading}
                                className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-xs text-slate-400 transition-colors border border-slate-800/50"
                            >
                                Send: "Yes, count me in!"
                            </button>
                            <hr className="border-slate-800 my-2" />
                            <button
                                onClick={() => triggerEvent("MATCH_FEEDBACK")}
                                disabled={!activePlayerId || loading}
                                className="w-full flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-medium transition-colors border border-orange-500/20"
                            >
                                <Trophy className="w-3 h-3" />
                                Trigger Feedback Nudge
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-slate-950/40 relative">
                    {/* Active Player Tabs */}
                    {selectedPlayerIds.length > 0 && (
                        <div className="flex items-center gap-1 px-4 py-2 bg-slate-900 border-b border-slate-800">
                            {selectedPlayerIds.map(id => {
                                const p = players.find(pl => pl.player_id === id)
                                return (
                                    <button
                                        key={id}
                                        onClick={() => setActivePlayerId(id)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activePlayerId === id
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                            }`}
                                    >
                                        {p?.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                        {activePlayerId ? (
                            activeMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                    <MessageSquare className="w-12 h-12 mb-4" />
                                    <p>Start conversation as {activePlayer?.name}</p>
                                </div>
                            ) : (
                                activeMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2`}>
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-tr-none'
                                            : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                                            } relative`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                                            {msg.role === 'assistant' && (
                                                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${msg.isCorrect === true ? 'bg-emerald-500/20 text-emerald-400' :
                                                            msg.isCorrect === false ? 'bg-rose-500/20 text-rose-400' :
                                                                'bg-slate-700 text-slate-400'
                                                            }`}>
                                                            {msg.intent || 'UNKNOWN'}
                                                        </span>
                                                        {msg.confidence !== undefined && <span className="text-[10px] text-slate-500">{(msg.confidence * 100).toFixed(0)}% confidence</span>}
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => markCorrect(activePlayerId, idx)}
                                                            className={`p-1 hover:bg-slate-700 rounded transition-colors ${msg.isCorrect === true ? 'text-emerald-400' : 'text-slate-500'}`}
                                                            title="Correct"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleCorrection(activePlayerId, idx)}
                                                            className={`p-1 hover:bg-slate-700 rounded transition-colors ${msg.isCorrect === false ? 'text-rose-400' : 'text-slate-500'}`}
                                                            title="Correction Required"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {msg.correction && (
                                                <div className="mt-2 text-[11px] bg-rose-500/10 border border-rose-500/20 rounded p-2 text-rose-300">
                                                    <div className="flex items-center gap-1 font-bold mb-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        CORRECTION
                                                    </div>
                                                    <p><span className="text-rose-400/70">Should be:</span> {msg.correction.intent}</p>
                                                    <p className="mt-1 font-medium italic text-slate-300">"{msg.correction.text}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                <Users className="w-12 h-12 mb-4" />
                                <p>Select players in the sidebar to begin</p>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-6 bg-slate-900/30 border-t border-slate-800">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder={activePlayer ? `Message as ${activePlayer.name}...` : "Select an active tab..."}
                                disabled={!activePlayerId || loading}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-4 pr-12 text-sm text-slate-100 transition-all placeholder:text-slate-500 disabled:opacity-50"
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                                {loading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar - Reasonable Thought */}
                <div className="w-80 border-l border-slate-800 bg-slate-900/20 p-6 flex flex-col gap-6 overflow-y-auto scrollbar-none">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <BrainCircuit className="w-4 h-4 text-indigo-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Thinking Process</h2>
                        </div>

                        {activeMessages.length > 0 && activeMessages[activeMessages.length - 1].role === 'assistant' ? (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-medium text-indigo-300 mb-1">Detected Intent</p>
                                    <p className="text-sm font-bold">{activeMessages[activeMessages.length - 1].intent || 'N/A'}</p>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-medium text-emerald-300 mb-1">Extracted Entities</p>
                                    <pre className="text-[10px] font-mono leading-tight max-h-40 overflow-y-auto">
                                        {activeMessages[activeMessages.length - 1].entities ? JSON.stringify(activeMessages[activeMessages.length - 1].entities, null, 2) : 'None'}
                                    </pre>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-medium text-amber-300 mb-1">Raw Reasoning</p>
                                    <p className="text-[11px] text-slate-300 italic leading-relaxed">
                                        {activeMessages[activeMessages.length - 1].reasoning || "No reasoning details available."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 italic">Select a message to analyze the reasoning chain.</p>
                        )}
                    </div>

                    <div className="mt-auto">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Context</h2>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">History:</span>
                                <span className="text-slate-300">{activeMessages.length} messages</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">Golden Samples:</span>
                                <span className="text-slate-300">{goldenSamples.length} active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Correction Modal */}
            {showCorrectionModal !== null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-rose-500/20 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Provide Correction</h3>
                                <p className="text-xs text-slate-400">How should the AI have responded?</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Correct Intent</label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    value={correctedIntent}
                                    onChange={(e) => setCorrectedIntent(e.target.value)}
                                >
                                    <option value="START_MATCH">START_MATCH</option>
                                    <option value="JOIN_GROUP">JOIN_GROUP</option>
                                    <option value="SET_AVAILABILITY">SET_AVAILABILITY</option>
                                    <option value="CHECK_STATUS">CHECK_STATUS</option>
                                    <option value="REPORT_RESULT">REPORT_RESULT</option>
                                    <option value="GREETING">GREETING</option>
                                    <option value="CHITCHAT">CHITCHAT</option>
                                    <option value="SUBMIT_FEEDBACK">SUBMIT_FEEDBACK</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Desired Response Body</label>
                                <textarea
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                    value={correctedResponse}
                                    onChange={(e) => setCorrectedResponse(e.target.value)}
                                    placeholder="Type the exact SMS the system should have sent..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCorrectionModal(null)}
                                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveCorrection}
                                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-sm font-medium transition-colors"
                            >
                                Apply Correction
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
