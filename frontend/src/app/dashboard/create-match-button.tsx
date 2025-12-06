'use client'

import { useState } from 'react'
import { MatchWizard } from './create-match-wizard'

interface CreateMatchButtonProps {
    clubId: string
}

export function CreateMatchButton({ clubId }: CreateMatchButtonProps) {
    const [showWizard, setShowWizard] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowWizard(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ml-3"
            >
                + Create Match
            </button>
            <MatchWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                clubId={clubId}
            />
        </>
    )
}
