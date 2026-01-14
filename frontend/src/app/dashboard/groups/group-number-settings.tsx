'use client'

import { useState } from 'react'
import { Group } from './group-details-client'
import { getSuggestedNumbers, provisionGroupNumber, releaseGroupNumber } from './actions'

interface GroupNumberSettingsProps {
    group: Group
}

interface SuggestedNumber {
    phone_number: string
    friendly_name: string
}

export function GroupNumberSettings({ group }: GroupNumberSettingsProps) {
    const [isSearching, setIsSearching] = useState(false)
    const [suggestedNumbers, setSuggestedNumbers] = useState<SuggestedNumber[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSearch = async () => {
        setIsSearching(true)
        setError(null)
        try {
            const { numbers } = await getSuggestedNumbers(group.group_id)
            setSuggestedNumbers(numbers)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to search numbers')
        } finally {
            setIsSearching(false)
        }
    }

    const handleProvision = async (number: string) => {
        if (!confirm(`Are you sure you want to provision ${number} for this group?`)) return

        setIsLoading(true)
        setError(null)
        try {
            await provisionGroupNumber(group.group_id, number)
            window.location.reload()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to provision number')
        } finally {
            setIsLoading(false)
        }
    }

    const handleRelease = async () => {
        if (!confirm('Are you sure you want to release this number? This cannot be undone and players will need to use the main club number again.')) return

        setIsLoading(true)
        setError(null)
        try {
            await releaseGroupNumber(group.group_id)
            window.location.reload()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to release number')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Dedicated Group Number</h2>
                    <p className="text-sm text-gray-500">
                        A dedicated number allows players to text the group directly.
                    </p>
                </div>
                {group.phone_number ? (
                    <button
                        onClick={handleRelease}
                        disabled={isLoading}
                        className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : 'Release Number'}
                    </button>
                ) : (
                    <button
                        onClick={handleSearch}
                        disabled={isSearching || isLoading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                    >
                        {isSearching ? 'Searching...' : 'Request Dedicated Number'}
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md">
                    {error}
                </div>
            )}

            {group.phone_number ? (
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-green-50 text-green-700 font-mono text-lg rounded-md border border-green-200">
                        {group.phone_number}
                    </div>
                    <span className="text-xs text-green-600 font-medium">● ACTIVE</span>
                </div>
            ) : suggestedNumbers.length > 0 && (
                <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Available matching numbers:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {suggestedNumbers.map((num) => (
                            <button
                                key={num.phone_number}
                                onClick={() => handleProvision(num.phone_number)}
                                disabled={isLoading}
                                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                            >
                                {num.friendly_name}
                            </button>
                        ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-400italic">
                        Selecting a number will instantly purchase and activate it.
                    </p>
                </div>
            )}
        </div>
    )
}
