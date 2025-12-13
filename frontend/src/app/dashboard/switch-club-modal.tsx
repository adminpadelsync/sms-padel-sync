'use client'

import { useState } from 'react'

interface SwitchClubModalProps {
    isOpen: boolean
    onClose: () => void
    clubs: { club_id: string; name: string }[]
    currentClubId: string | null
}

export function SwitchClubModal({ isOpen, onClose, clubs, currentClubId }: SwitchClubModalProps) {
    const [selectedId, setSelectedId] = useState<string>(currentClubId || clubs[0]?.club_id || '')
    const [isSwitching, setIsSwitching] = useState(false)

    if (!isOpen) return null

    const handleSwitch = () => {
        setIsSwitching(true)
        // Set persistence
        localStorage.setItem('selectedClubId', selectedId)
        document.cookie = `operating_club_id=${selectedId}; path=/; max-age=31536000`

        // Force full reload to ensure server context is updated
        window.location.href = '/dashboard'
    }

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 relative z-10">
                    <div>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
                            <span className="text-2xl">🏢</span>
                        </div>
                        <div className="mt-3 text-center sm:mt-5">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">
                                Switch Operating Club
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 mb-4">
                                    Select the club you want to manage. The dashboard will reload to apply the new context.
                                </p>
                                <select
                                    value={selectedId}
                                    onChange={(e) => setSelectedId(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    {clubs.map((club) => (
                                        <option key={club.club_id} value={club.club_id}>
                                            {club.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                        <button
                            type="button"
                            onClick={handleSwitch}
                            disabled={isSwitching}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                        >
                            {isSwitching ? 'Switching...' : 'Switch Club'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSwitching}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
