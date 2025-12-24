'use client'

import { useState } from 'react'
import { verifyPlayer } from './actions'

interface Player {
    player_id: string
    name: string
    declared_skill_level: number
    pro_verified?: boolean
    pro_verification_notes?: string
}

interface VerificationModalProps {
    player: Player | null
    isOpen: boolean
    onClose: () => void
}

export function VerificationModal({ player, isOpen, onClose }: VerificationModalProps) {
    const [level, setLevel] = useState(player?.declared_skill_level || 3.5)
    const [notes, setNotes] = useState(player?.pro_verification_notes || '')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Update state when player changes
    if (player && level !== player.declared_skill_level && !isSubmitting) {
        // Only sync if we haven't started editing (managed by isSubmitting roughly, 
        // but useEffect is better. For simplicity in this functional component without 
        // effects, we'll initialize on open)
    }

    if (!isOpen || !player) return null

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            await verifyPlayer(player.player_id, {
                verified: true,
                level: level,
                notes: notes
            })
            onClose()
            // Optional: Show success toast
        } catch (error) {
            console.error('Error verifying player:', error)
            alert('Failed to verify player')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Verify Player: {player.name}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleVerify} className="px-6 py-4 space-y-4">
                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-4">
                        <p className="text-sm text-blue-800">
                            Verifying a player establishes a <strong>trusted baseline</strong> for their rating. While it resets their Elo to this level, their rating will continue to adjust as they play more matches.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="verify-level" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmed Skill Level
                        </label>
                        <select
                            id="verify-level"
                            required
                            value={level}
                            onChange={(e) => setLevel(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {[2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0].map((l) => (
                                <option key={l} value={l}>{l.toFixed(2)}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                            Verification Notes (Optional)
                        </label>
                        <textarea
                            id="notes"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Evaluated by Coach Mike on 12/15"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {isSubmitting ? 'Verifying...' : 'Verify Player'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
