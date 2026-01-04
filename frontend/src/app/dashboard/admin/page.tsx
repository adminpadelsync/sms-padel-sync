'use client'

import { useState, useEffect } from 'react'

interface Club {
    club_id: string;
    name: string;
    phone_number: string;
}

export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
    const [clubs, setClubs] = useState<Club[]>([])
    const [isFetchingClubs, setIsFetchingClubs] = useState(true)
    const [clubToDelete, setClubToDelete] = useState<Club | null>(null)
    const [deleteConfirmationName, setDeleteConfirmationName] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [deletionLogs, setDeletionLogs] = useState<{ step: string; status: 'success' | 'warning' | 'error'; message: string; timestamp: string }[]>([])
    const [showLogModal, setShowLogModal] = useState(false)

    const formatPhoneNumber = (phone: string) => {
        if (!phone) return '';
        // Strip everything but digits
        const digits = phone.replace(/\D/g, '');

        // If it's a 11-digit number starting with 1 (US format) or 10-digit number
        if (digits.length === 11 && digits.startsWith('1')) {
            return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return phone;
    }

    useEffect(() => {
        fetchClubs()
    }, [])

    const fetchClubs = async () => {
        setIsFetchingClubs(true)
        try {
            const res = await fetch('/api/clubs')
            const data = await res.json()
            if (res.ok) {
                setClubs(data.clubs || [])
            }
        } catch (err) {
            console.error('Error fetching clubs:', err)
        } finally {
            setIsFetchingClubs(false)
        }
    }

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
        } catch (err) {
            const error = err as Error
            setResult({ success: false, message: error.message || 'An error occurred' })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteClub = async () => {
        if (!clubToDelete || deleteConfirmationName !== clubToDelete.name) return

        setIsLoading(true)
        setDeletionLogs([]) // Reset logs
        try {
            const res = await fetch(`/api/clubs/${clubToDelete.club_id}`, {
                method: 'DELETE'
            })
            const data = await res.json()

            if (!res.ok) {
                if (data.logs) setDeletionLogs(data.logs)
                throw new Error(data.detail || 'Failed to delete club')
            }

            setDeletionLogs(data.logs || [])
            setResult({ success: true, message: 'Club deleted successfully' })
            setClubToDelete(null)
            setDeleteConfirmationName('')
            setShowLogModal(true) // Show logs on success
            fetchClubs() // Refresh list
        } catch (err) {
            const error = err as Error
            setResult({ success: false, message: error.message || 'An error occurred' })
            setShowLogModal(true) // Show logs even on failure to see progress
        } finally {
            setIsLoading(false)
        }
    }

    const downloadLogs = () => {
        const logContent = deletionLogs.map(log =>
            `[${log.timestamp}] ${log.status.toUpperCase()}: ${log.step} - ${log.message}`
        ).join('\n')

        const blob = new Blob([logContent], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `deletion-log-${clubToDelete?.name.replace(/\s+/g, '-').toLowerCase() || 'club'}-${new Date().toISOString().slice(0, 10)}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Super User Administration</h1>

            <div className="grid grid-cols-1 gap-6">
                {/* Club Management Section */}
                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-semibold text-gray-900">Club Management</h2>
                                <a
                                    href="/dashboard/clubs/new"
                                    className="px-3 py-1 text-xs font-bold text-green-600 hover:text-green-800 border border-green-600 rounded hover:bg-green-50 transition-colors"
                                >
                                    + NEW CLUB
                                </a>
                            </div>
                            <p className="text-gray-500 mt-1 max-w-md">
                                View and manage system clubs. Deleting a club will remove all associated matches, courts, and memberships.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <div className="mb-4 relative">
                            <input
                                type="text"
                                placeholder="Search clubs by name or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {isFetchingClubs ? (
                            <div className="flex justify-center py-4">
                                <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        ) : clubs.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">No clubs found.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {clubs
                                    .filter(club =>
                                        club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        club.phone_number.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
                                    )
                                    .map((club) => (
                                        <li key={club.club_id} className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded-lg transition-colors">
                                            <div>
                                                <p className="font-medium text-gray-900">{club.name}</p>
                                                <p className="text-xs text-gray-500 font-mono tracking-wider">
                                                    {formatPhoneNumber(club.phone_number)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setClubToDelete(club)}
                                                className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </li>
                                    ))
                                }
                                {clubs.filter(club =>
                                    club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    club.phone_number.includes(searchTerm)
                                ).length === 0 && searchTerm && (
                                        <p className="text-gray-400 text-center py-4">No clubs match your search.</p>
                                    )}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Scoring Engine Control</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                Manually trigger the score recalculation job. This will update &quot;Responsiveness&quot; and &quot;Reputation&quot; scores for all players based on their invite history.
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


                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Match Simulator Jig</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                Test end-to-end match flows including result reporting and feedback collection. Simulate 4-player interactions and verify rating updates.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-6">
                        <a
                            href="/dashboard/admin/match-jig"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            Open Match Jig
                        </a>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI Reasoner Training Jig</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                Coach the AI by simulating conversations. Mark responses as correct or incorrect to build the &quot;Golden Dataset&quot; and improve reasoning.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-6">
                        <a
                            href="/dashboard/admin/training"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            Open Training Jig
                        </a>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Level Assessments</h2>
                            <p className="text-gray-500 mt-1 max-w-md">
                                View results from the public padel skill assessment tool. Track lead generation and player skill distributions.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-6">
                        <a
                            href="/dashboard/admin/assessments"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            View Assessments
                        </a>
                    </div>
                </div>

                <div className="md:col-span-1">
                    <div className="bg-white rounded-lg shadow p-6 max-w-2xl border border-gray-200">
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

            {/* Delete Confirmation Modal */}
            {clubToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center text-red-600 mb-4">
                            <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h3 className="text-xl font-bold">Dangerous Action</h3>
                        </div>

                        <p className="text-gray-700 mb-4">
                            You are about to delete <span className="font-bold text-gray-900">&quot;{clubToDelete.name}&quot;</span>.
                            This will permanently remove all associated courts, matches, and groups.
                        </p>

                        <div className="bg-red-50 p-4 rounded-lg mb-6 text-sm text-red-800 border border-red-100">
                            <strong>This action cannot be undone.</strong> Please type the club name below to confirm.
                        </div>

                        <input
                            type="text"
                            value={deleteConfirmationName}
                            onChange={(e) => setDeleteConfirmationName(e.target.value)}
                            placeholder={clubToDelete.name}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-6 text-gray-900"
                        />

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setClubToDelete(null)
                                    setDeleteConfirmationName('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteClub}
                                disabled={isLoading || deleteConfirmationName !== clubToDelete.name}
                                className="px-6 py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                            >
                                {isLoading ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Deletion Log Modal */}
            {showLogModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 no-print">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Deletion Summary</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Step-by-step history of the club removal process.</p>
                            </div>
                            <button
                                onClick={() => setShowLogModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-full transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 print:p-0">
                            {deletionLogs.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-4 border-b-2 border-indigo-600 rounded-full" />
                                    <p className="text-gray-500">Retrieving logs...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {deletionLogs.map((log, i) => (
                                        <div key={i} className={`p-4 rounded-xl border flex items-start gap-4 transition-all hover:shadow-sm ${log.status === 'success' ? 'bg-green-50/30 border-green-100' :
                                            log.status === 'warning' ? 'bg-yellow-50/30 border-yellow-100' :
                                                'bg-red-50/30 border-red-100'
                                            }`}>
                                            <div className="mt-0.5">
                                                {log.status === 'success' ? (
                                                    <div className="bg-green-500 rounded-full p-1"><svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div>
                                                ) : log.status === 'warning' ? (
                                                    <div className="bg-yellow-500 rounded-full p-1"><svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4" /></svg></div>
                                                ) : (
                                                    <div className="bg-red-500 rounded-full p-1"><svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-bold text-sm text-gray-900 truncate">{log.step}</p>
                                                    <span className="text-[10px] font-mono text-gray-400 shrink-0">
                                                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{log.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3 print:hidden">
                            <button
                                onClick={downloadLogs}
                                className="flex-1 inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 bg-white text-sm font-semibold rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Save as .txt
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex-1 inline-flex justify-center items-center px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-indigo-200 shadow-lg transition-all"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Save as PDF (Print)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print-only View */}
            <div className="hidden print:block p-8 bg-white text-black font-sans">
                <h1 className="text-2xl font-bold mb-2">Club Deletion Audit Log</h1>
                <p className="text-gray-600 mb-6">Generated on {new Date().toLocaleString()}</p>
                <div className="border-t-2 border-black pt-4">
                    {deletionLogs.map((log, i) => (
                        <div key={i} className="mb-4 pb-4 border-b border-gray-200">
                            <div className="flex justify-between items-baseline mb-1">
                                <h3 className="font-bold uppercase tracking-tight text-sm">[{log.status}] {log.step}</h3>
                                <span className="text-xs font-mono">{log.timestamp}</span>
                            </div>
                            <p className="text-sm">{log.message}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-8 text-[10px] text-gray-400 border-t border-gray-100 pt-2 italic">
                    This document serves as an official cleanup record for SMS Padel Sync.
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-section, .print-section * {
                        visibility: visible;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .hidden.print\\:block {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .hidden.print\\:block * {
                        visibility: visible !important;
                    }
                }
            `}</style>
        </div>
    )
}
