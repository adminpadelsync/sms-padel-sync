'use client'

import { useState } from 'react'
import { PlayerModal } from './player-management'

interface CreatePlayerButtonProps {
    clubId: string
}

export function CreatePlayerButton({ clubId }: CreatePlayerButtonProps) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
                + Add Player
            </button>
            <PlayerModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                mode="create"
                clubId={clubId}
            />
        </>
    )
}
