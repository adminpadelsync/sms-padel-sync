'use client'

import { useState } from 'react'

interface ScenarioStep {
    user_input: string
    expected_intent?: string
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
}

export default function ScenarioTesterClient() {
    const [steps, setSteps] = useState<ScenarioStep[]>([
        { user_input: 'Hello' },
        { user_input: 'I want to play on Sunday at 4pm' }
    ])
    const [results, setResults] = useState<StepResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const addStep = () => {
        setSteps([...steps, { user_input: '' }])
    }

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index))
    }

    const updateStep = (index: number, value: string) => {
        const newSteps = [...steps]
        newSteps[index].user_input = value
        setSteps(newSteps)
    }

    const runScenario = async () => {
        setIsLoading(true)
        setError(null)
        setResults([])

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/test/scenario`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    initial_state: 'IDLE',
                    steps: steps.filter(s => s.user_input.trim())
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to run scenario')
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
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">Conversational Scenario Tester</h1>
            <p className="text-gray-500 mb-8">
                Test how the AI Reasoner interprets a sequence of user messages. This tool simulates the NLP layer without sending real SMS.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4 text-gray-800">Scenario Input</h2>
                        <div className="space-y-3">
                            {steps.map((step, index) => (
                                <div key={index} className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            Step {index + 1}
                                        </label>
                                        <input
                                            type="text"
                                            value={step.user_input}
                                            onChange={(e) => updateStep(index, e.target.value)}
                                            placeholder="User says..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeStep(index)}
                                        className="mt-6 text-red-500 hover:text-red-700 px-2"
                                        title="Remove step"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addStep}
                            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            + Add Step
                        </button>
                    </div>

                    <button
                        onClick={runScenario}
                        disabled={isLoading}
                        className={`w-full py-3 px-4 rounded-md text-white font-medium ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {isLoading ? 'Running Analysis...' : 'Run Scenario Analysis'}
                    </button>

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
                        <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            Run a scenario to see how the AI parses it.
                        </div>
                    )}

                    <div className="space-y-4">
                        {results.map((res, idx) => (
                            <div key={idx} className="bg-white border-l-4 border-indigo-500 shadow-sm rounded-r-lg p-4">
                                <div className="text-sm text-gray-500 mb-1">Step {idx + 1} Input</div>
                                <div className="text-lg font-medium text-gray-900 mb-3">"{res.input}"</div>

                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div className="bg-gray-50 p-2 rounded">
                                        <div className="text-xs text-gray-500 uppercase">Detected Intent</div>
                                        <div className="font-mono text-sm font-bold text-indigo-700">{res.intent}</div>
                                        <div className="text-xs text-gray-400">Conf: {(res.confidence * 100).toFixed(0)}%</div>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded">
                                        <div className="text-xs text-gray-500 uppercase">Entities</div>
                                        {Object.keys(res.entities).length > 0 ? (
                                            <ul className="text-xs">
                                                {Object.entries(res.entities).map(([k, v]) => (
                                                    <li key={k}><span className="font-semibold">{k}:</span> {String(v)}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="text-xs text-gray-400 italic">None detected</div>
                                        )}
                                    </div>
                                </div>

                                {res.state_before !== res.state_after && (
                                    <div className="text-sm bg-yellow-50 text-yellow-800 px-2 py-1 rounded inline-block mb-2">
                                        State Transition: {res.state_before} &rarr; {res.state_after}
                                    </div>
                                )}

                                {res.reasoning && (
                                    <div className="mt-2 text-xs text-gray-500 border-t pt-2">
                                        <span className="font-semibold">Reasoning:</span>
                                        <pre className="whitespace-pre-wrap mt-1 font-mono bg-gray-50 p-2 rounded">{JSON.stringify(JSON.parse(res.reasoning || '{}'), null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
