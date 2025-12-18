'use client'

import { useState } from 'react'

export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleRecalculate = async () => {
        setIsLoading(true)
        setResult(null)
        try {
            const res = await fetch('/api/cron/recalculate-scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Failed to recalculate')

            setResult({ success: true, message: data.message })
        } catch (err: any) {
            setResult({ success: false, message: err.message || 'An error occurred' })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Super User Administration</h1>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Scoring Engine Control</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                Manually trigger the score recalculation job. This will update "Responsiveness" and "Reputation" scores for all players based on their invite history.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleRecalculate}
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                'Recalculate All Scores'
                            )}
                        </button>
                    </div>

                    {result && (
                        <div className={`mt-4 p-4 rounded-md flex items-start ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div className="flex-shrink-0">
                                {result.success ? (
                                    <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3">
                                <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {result.message}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">SMS Simulator</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                Test SMS match flow with simulated player responses. Verify logic for invites, confirmations, and feedback without sending real messages.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-6">
                        <a
                            href="/dashboard/admin/simulator"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            Open SMS Simulator
                        </a>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200 opacity-60">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">System Health (Planned)</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                Monitor system performance, SMS delivery rates, and active user stats.
                            </p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Scenario Tester</h2>
                                <p className="text-gray-500 mt-1 max-w-md">
                                    Test conversational flows and NLP reasoning without sending real SMS messages. Verify intent extraction and state transitions.
                                </p>
                            </div>
                            <div className="bg-indigo-50 p-2 rounded-lg">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                        </div>
                        <div className="mt-6">
                            <a
                                href="/dashboard/admin/scenarios"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                Open Scenario Tester
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
