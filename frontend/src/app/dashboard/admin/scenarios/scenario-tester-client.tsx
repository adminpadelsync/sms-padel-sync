'use client'

import { useState, useEffect } from 'react'

interface ScenarioStep {
    user_input: string
    expected_intent?: string
    expected_entities?: Record<string, any>
}

interface StepResult {
    input: string
    intent: string
    confidence: number
    entities: Record<string, any>
    state_before: string
    state_after: string
    simulated_reply: string
    reasoning?: string
    expected_intent?: string
    passed_intent?: boolean
}

interface GoldenScenario {
    id: string
    name: string
    initial_state: string
    steps: ScenarioStep[]
    created_at: string
}

export default function ScenarioTesterClient() {
    const [activeTab, setActiveTab] = useState<'test' | 'golden'>('test')
    const [steps, setSteps] = useState<ScenarioStep[]>([
        { user_input: 'Hello' },
        { user_input: 'I want to play on Sunday at 4pm' }
    ])
    const [initialState, setInitialState] = useState('IDLE')
    const [results, setResults] = useState<StepResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [scenarioName, setScenarioName] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // Golden Dataset State
    const [goldenScenarios, setGoldenScenarios] = useState<GoldenScenario[]>([])
    const [isLoadingGolden, setIsLoadingGolden] = useState(false)

    const AVAILABLE_STATES = [
        'IDLE',
        'WAITING_NAME',
        'STATE_MATCH_REQUEST_DATE',
        'WAITING_FEEDBACK',
        'BROWSING_GROUPS',
        'UPDATING_AVAILABILITY'
    ]

    useEffect(() => {
        if (activeTab === 'golden') {
            fetchGoldenScenarios()
        }
    }, [activeTab])

    const fetchGoldenScenarios = async () => {
        setIsLoadingGolden(true)
        try {
            const res = await fetch('/api/test/scenarios')
            const data = await res.json()
            setGoldenScenarios(data.scenarios || [])
        } catch (err) {
            console.error('Failed to fetch golden scenarios', err)
        } finally {
            setIsLoadingGolden(false)
        }
    }

    const saveAsGolden = async () => {
        if (!scenarioName.trim()) {
            setError('Please enter a name for the scenario')
            return
        }
        setIsSaving(true)
        try {
            // Include expected intents from current results if available
            const stepsToSave = steps.map((s, idx) => ({
                ...s,
                expected_intent: results[idx]?.intent || s.expected_intent
            }))

            const res = await fetch('/api/test/scenarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: scenarioName,
                    initial_state: initialState,
                    steps: stepsToSave
                })
            })
            if (res.ok) {
                setScenarioName('')
                alert('Saved to Golden Dataset!')
                fetchGoldenScenarios()
            }
        } catch (err) {
            setError('Failed to save scenario')
        } finally {
            setIsSaving(false)
        }
    }

    const loadScenario = (gs: GoldenScenario) => {
        setInitialState(gs.initial_state)
        setSteps(gs.steps)
        setResults([])
        setActiveTab('test')
    }

    const deleteScenario = async (id: string) => {
        if (!confirm('Are you sure you want to delete this scenario?')) return
        try {
            await fetch(`/api/test/scenarios/${id}`, { method: 'DELETE' })
            fetchGoldenScenarios()
        } catch (err) {
            alert('Failed to delete')
        }
    }

    const addStep = () => {
        setSteps([...steps, { user_input: '' }])
    }

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index))
    }

    const updateStep = (index: number, field: keyof ScenarioStep, value: string) => {
        const newSteps = [...steps]
        newSteps[index] = { ...newSteps[index], [field]: value }
        setSteps(newSteps)
    }

    const runScenario = async () => {
        setIsLoading(true)
        setError(null)
        setResults([])

        try {
            const response = await fetch('/api/test/scenario', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    initial_state: initialState,
                    steps: steps.filter(s => s.user_input.trim())
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }))
                throw new Error(errorData.detail || `Server Error: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()
            setResults(data.step_results)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Conversational Scenario Tester</h1>
                    <p className="text-gray-500">
                        Test and verify the AI Reasoner's logic across multi-step conversations.
                    </p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('test')}
                        className={`px-4 py-2 rounded-md transition-all ${activeTab === 'test' ? 'bg-white shadow-sm text-indigo-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Live Test
                    </button>
                    <button
                        onClick={() => setActiveTab('golden')}
                        className={`px-4 py-2 rounded-md transition-all ${activeTab === 'golden' ? 'bg-white shadow-sm text-indigo-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Golden Dataset
                    </button>
                </div>
            </div>

            {activeTab === 'test' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Input Column */}
                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800">Scenario Configuration</h2>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Initial State (Mock context)
                                </label>
                                <select
                                    value={initialState}
                                    onChange={(e) => setInitialState(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50 font-mono text-sm"
                                >
                                    {AVAILABLE_STATES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <h2 className="text-lg font-semibold mb-4 text-gray-800 border-t pt-4">Scenario Steps</h2>
                            <div className="space-y-4">
                                {steps.map((step, index) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded-lg relative">
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                Step {index + 1}
                                            </label>
                                            <button
                                                onClick={() => removeStep(index)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                title="Remove step"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={step.user_input}
                                                onChange={(e) => updateStep(index, 'user_input', e.target.value)}
                                                placeholder="User says..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            />
                                            <div className="flex gap-2 items-center">
                                                <span className="text-xs text-gray-500">Expected Intent (Optional):</span>
                                                <input
                                                    type="text"
                                                    value={step.expected_intent || ''}
                                                    onChange={(e) => updateStep(index, 'expected_intent', e.target.value)}
                                                    placeholder="START_MATCH"
                                                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addStep}
                                className="mt-4 w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all font-medium"
                            >
                                + Add Step
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={runScenario}
                                disabled={isLoading}
                                className={`flex-1 py-3 px-4 rounded-lg text-white font-bold shadow-md transition-all ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                                    }`}
                            >
                                {isLoading ? 'Running Analysis...' : '🚀 Run Scenario Analysis'}
                            </button>
                        </div>

                        {results.length > 0 && (
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <h3 className="text-sm font-bold text-indigo-900 mb-3">Persistence</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Scenario Name (e.g. Happy Path Play)"
                                        value={scenarioName}
                                        onChange={(e) => setScenarioName(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-indigo-200 rounded-md text-sm"
                                    />
                                    <button
                                        onClick={saveAsGolden}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-white border border-indigo-600 text-indigo-600 font-semibold rounded-md hover:bg-indigo-600 hover:text-white transition-all text-sm disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : '⭐ Save as Golden'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Results Column */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold mb-4 text-gray-800">Analysis Results</h2>

                        {results.length === 0 && !isLoading && (
                            <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center">
                                <div className="text-4xl mb-4 text-gray-200">💬</div>
                                Run a scenario to see how the AI parses it.
                            </div>
                        )}

                        <div className="space-y-6">
                            {results.map((res, idx) => (
                                <div key={idx} className={`bg-white border-l-4 ${res.passed_intent === false ? 'border-red-500' : 'border-emerald-500'} shadow-sm rounded-r-xl p-5 relative overflow-hidden`}>
                                    <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Step {idx + 1} Input</div>
                                    <div className="text-xl font-semibold text-gray-900 mb-4 tracking-tight">"{res.input}"</div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <div className={`p-3 rounded-lg ${res.passed_intent === false ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="text-[10px] font-bold text-gray-500 uppercase">Intent</div>
                                                {res.passed_intent === true && <span className="text-emerald-600 text-[10px] font-bold">✅ MATCH</span>}
                                                {res.passed_intent === false && <span className="text-red-600 text-[10px] font-bold">❌ MISMATCH</span>}
                                            </div>
                                            <div className="font-mono text-sm font-black text-gray-800 break-all">{res.intent}</div>
                                            {res.expected_intent && res.passed_intent === false && (
                                                <div className="mt-1 text-[10px] text-red-600 bg-white px-1 py-0.5 rounded inline-block">Expected: {res.expected_intent}</div>
                                            )}
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Entities</div>
                                            {Object.keys(res.entities).length > 0 ? (
                                                <ul className="space-y-1">
                                                    {Object.entries(res.entities).map(([k, v]) => (
                                                        <li key={k} className="text-[11px] flex justify-between">
                                                            <span className="font-bold text-gray-600">{k}:</span>
                                                            <span className="text-indigo-600 font-mono">{String(v)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-xs text-gray-400 italic">None detected</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <div className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                            STATE: {res.state_before} &rarr; {res.state_after}
                                        </div>
                                        <div className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">
                                            ACTION: {res.simulated_reply}
                                        </div>
                                    </div>

                                    {res.reasoning && (
                                        <details className="mt-4 border-t pt-4">
                                            <summary className="text-xs font-bold text-gray-400 cursor-pointer hover:text-gray-600 uppercase tracking-widest">View AI Reasoning</summary>
                                            <pre className="mt-2 text-[10px] font-mono bg-gray-900 text-emerald-400 p-4 rounded-lg overflow-x-auto selection:bg-indigo-500">
                                                {JSON.stringify(JSON.parse(res.reasoning || '{}'), null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Golden Scenarios</h2>
                        <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                            {goldenScenarios.length} Scenarios Saved
                        </span>
                    </div>

                    {isLoadingGolden ? (
                        <div className="p-12 text-center text-gray-400 italic">Loading Golden Dataset...</div>
                    ) : goldenScenarios.length === 0 ? (
                        <div className="p-16 text-center text-gray-400 flex flex-col items-center">
                            <div className="text-5xl mb-4 opacity-20">⭐</div>
                            <p className="font-medium text-gray-500">No Golden scenarios saved yet.</p>
                            <p className="text-sm mt-1 max-w-xs mx-auto">Save successful test runs from the Live Test tab to build your regression suite.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {goldenScenarios.map((gs) => (
                                <div key={gs.id} className="p-6 hover:bg-indigo-50 transition-colors flex justify-between items-start group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900">{gs.name}</h3>
                                            <span className="text-[10px] font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                                {gs.initial_state}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 items-center">
                                            <p className="text-xs text-gray-500">
                                                {gs.steps.length} Steps • {new Date(gs.created_at).toLocaleDateString()}
                                            </p>
                                            <div className="flex -space-x-1">
                                                {gs.steps.slice(0, 3).map((s, i) => (
                                                    <div key={i} className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-400" title={s.user_input}>
                                                        {i + 1}
                                                    </div>
                                                ))}
                                                {gs.steps.length > 3 && (
                                                    <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-400">
                                                        +{gs.steps.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => loadScenario(gs)}
                                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                                        >
                                            Run Test
                                        </button>
                                        <button
                                            onClick={() => deleteScenario(gs.id)}
                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                            title="Delete Scenario"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
