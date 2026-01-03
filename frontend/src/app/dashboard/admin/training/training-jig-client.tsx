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
    MessageSquare
} from 'lucide-react'

interface Player {
    player_id: string
    name: string
    phone_number: string
    declared_skill_level: number
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
    const [players, setPlayers] = useState<Player[]>([])
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [goldenSamples, setGoldenSamples] = useState<GoldenSample[]>([])
    const [showCorrectionModal, setShowCorrectionModal] = useState<number | null>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Correction Modal State
    const [correctedIntent, setCorrectedIntent] = useState('')
    const [correctedResponse, setCorrectedResponse] = useState('')

    useEffect(() => {
        fetchPlayers()
        fetchGoldenSamples()
    }, [])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

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

    const fetchGoldenSamples = async () => {
        try {
            const res = await fetch('/api/training/golden-samples')
            const data = await res.json()
            if (data.samples) setGoldenSamples(data.samples)
        } catch (e) {
            console.error("Failed to fetch golden samples", e)
        }
    }

    const sendMessage = async () => {
        if (!input.trim() || !selectedPlayer || loading) return

        const userMsg: Message = {
            role: 'user',
            text: input,
            timestamp: new Date()
        }

        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        setLoading(true)

        try {
            // Prepare history for API
            const history = messages.map(m => ({
                role: m.role,
                text: m.text
            }))

            const response = await fetch('/api/training/step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: selectedPlayer.player_id,
                    message: input,
                    history: history,
                    golden_samples: goldenSamples.slice(0, 3) // Provide 3 few-shot examples
                })
            })

            const data = await response.json()

            if (data.responses) {
                const assistantMsg: Message = {
                    role: 'assistant',
                    text: data.responses.join('\n'),
                    timestamp: new Date(),
                    intent: data.intent,
                    confidence: data.confidence,
                    entities: data.entities,
                    reasoning: data.raw_reasoning
                }
                setMessages(prev => [...prev, assistantMsg])
            }
        } catch (e) {
            console.error("Simulation failed", e)
        } finally {
            setLoading(false)
        }
    }

    const handleCorrection = (index: number) => {
        const msg = messages[index]
        setCorrectedIntent(msg.intent || '')
        setCorrectedResponse(msg.text)
        setShowCorrectionModal(index)
    }

    const saveCorrection = () => {
        if (showCorrectionModal === null) return

        const newMessages = [...messages]
        newMessages[showCorrectionModal] = {
            ...newMessages[showCorrectionModal],
            isCorrect: false,
            correction: {
                intent: correctedIntent,
                text: correctedResponse
            }
        }
        setMessages(newMessages)
        setShowCorrectionModal(null)
    }

    const markCorrect = (index: number) => {
        const newMessages = [...messages]
        newMessages[index] = { ...newMessages[index], isCorrect: true }
        setMessages(newMessages)
    }

    const saveToGoldenDataset = async () => {
        if (!selectedPlayer || messages.length === 0) return
        setSaving(true)

        try {
            // Convert current transcript to Golden Sample format
            const steps = []
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].role === 'user') {
                    const nextAssistant = messages[i + 1]
                    if (nextAssistant && nextAssistant.role === 'assistant') {
                        steps.push({
                            user_input: messages[i].text,
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
                    name: `Training Session - ${selectedPlayer.name} - ${new Date().toLocaleDateString()}`,
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
        setMessages([])
        setInput('')
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
                        <p className="text-xs text-slate-400">Perfect your AI by simulating human conversations</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <select
                            className="bg-slate-800 border-none text-sm rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer min-w-[200px]"
                            onChange={(e) => {
                                const p = players.find(pl => pl.player_id === e.target.value)
                                setSelectedPlayer(p || null)
                                resetSession()
                            }}
                            value={selectedPlayer?.player_id || ''}
                        >
                            <option value="">Select a Player to Test...</option>
                            {players.map(p => (
                                <option key={p.player_id} value={p.player_id}>{p.name} (Lvl {p.declared_skill_level})</option>
                            ))}
                        </select>
                        <User className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>

                    <button
                        onClick={resetSession}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                        title="Reset Session"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>

                    <button
                        onClick={saveToGoldenDataset}
                        disabled={saving || messages.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {saving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save to Golden Dataset
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-slate-950/40 relative">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                <MessageSquare className="w-12 h-12 mb-4" />
                                <p>Start a conversation to see the AI's reasoning</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                                    } relative`}>
                                    <p className="text-sm leading-relaxed">{msg.text}</p>

                                    {msg.role === 'assistant' && (
                                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${msg.isCorrect === true ? 'bg-emerald-500/20 text-emerald-400' :
                                                    msg.isCorrect === false ? 'bg-rose-500/20 text-rose-400' :
                                                        'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {msg.intent || 'UNKNOWN'}
                                                </span>
                                                <span className="text-[10px] text-slate-500">{((msg.confidence || 0) * 100).toFixed(0)}% confidence</span>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => markCorrect(idx)}
                                                    className={`p-1 hover:bg-slate-700 rounded transition-colors ${msg.isCorrect === true ? 'text-emerald-400' : 'text-slate-500'}`}
                                                    title="Correct"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleCorrection(idx)}
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
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-6 bg-slate-900/30 border-t border-slate-800">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder={selectedPlayer ? `Message as ${selectedPlayer.name}...` : "Select a player first..."}
                                disabled={!selectedPlayer || loading}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-4 pr-12 text-sm text-slate-100 transition-all placeholder:text-slate-500 disabled:opacity-50"
                            />
                            <button
                                onClick={sendMessage}
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

                        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' ? (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-medium text-indigo-300 mb-1">Detected Intent</p>
                                    <p className="text-sm font-bold">{messages[messages.length - 1].intent}</p>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-medium text-emerald-300 mb-1">Extracted Entities</p>
                                    <pre className="text-[10px] font-mono leading-tight max-h-40 overflow-y-auto">
                                        {JSON.stringify(messages[messages.length - 1].entities, null, 2)}
                                    </pre>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-medium text-amber-300 mb-1">Raw Reasoning</p>
                                    <p className="text-[11px] text-slate-300 italic leading-relaxed">
                                        {messages[messages.length - 1].reasoning || "No reasoning details available."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 italic">Send a message to analyze the reasoning chain.</p>
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
                                <span className="text-slate-300">{messages.length} messages</span>
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
