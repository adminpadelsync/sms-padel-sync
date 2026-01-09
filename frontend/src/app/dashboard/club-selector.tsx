'use client'

import { useState, useEffect } from 'react'

interface ClubSelectorProps {
    clubs: { club_id: string; name: string }[]
    defaultClubId: string | null
    onClubChange: (clubId: string) => void
}

export function ClubSelector({ clubs, defaultClubId, onClubChange }: ClubSelectorProps) {
    const [selectedClubId, setSelectedClubId] = useState<string>(() => {
        // Try to load from localStorage first
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('selectedClubId')
            if (stored && clubs.find(c => c.club_id === stored)) {
                return stored
            }
        }
        return defaultClubId || clubs[0]?.club_id || ''
    })

    useEffect(() => {
        // Persist to localStorage
        if (selectedClubId) {
            localStorage.setItem('selectedClubId', selectedClubId)
            onClubChange(selectedClubId)
        }
    }, [selectedClubId, onClubChange])

    if (clubs.length === 0) return null

    return (
        <div className="flex items-center gap-2">
            <label htmlFor="club-selector" className="text-sm font-medium text-gray-700">
                Operating Club:
            </label>
            <select
                id="club-selector"
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {clubs.map(club => (
                    <option key={club.club_id} value={club.club_id}>
                        {club.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
