'use client'

import { logout } from './actions'

export function LogoutButton() {
    return (
        <button
            onClick={() => logout()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
            Logout
        </button>
    )
}
