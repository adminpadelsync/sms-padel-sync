'use client'

import { useState, useEffect } from 'react'

interface Message {
    id: string
    from: 'system' | 'player'
    text: string
    timestamp: Date
}

interface Club {
    club_id: string
    name: string
    phone_number: string
}

interface Group {
    group_id: string
    name: string
    phone_number: string | null
}

interface PlayerColumnProps {
    player: {
        player_id: string
        name: string
        phone_number: string
    }
    messages: Message[]
    onSendMessage: (message: string) => void
    clubs?: Club[]
    groups?: Group[]
    selectedToNumber?: string
    onToNumberChange?: (phoneNumber: string) => void
}

export function PlayerColumn({
    player,
    messages,
    onSendMessage,
    clubs = [],
    groups = [],
    selectedToNumber,
    onToNumberChange
}: PlayerColumnProps) {
    const [inputText, setInputText] = useState('')

    const handleSend = () => {
        if (inputText.trim()) {
            onSendMessage(inputText)
            setInputText('')
        }
    }

    const handleQuickAction = (action: string) => {
        onSendMessage(action)
    }

    // Default to first club phone if nothing selected
    const activeToNumber = selectedToNumber || clubs[0]?.phone_number || ''

    return (
        <div className="flex flex-col h-full border border-gray-300 rounded-lg bg-white">
            {/* Player Header */}
            <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="font-medium text-gray-900">{player.name}</div>
                <div className="text-xs text-gray-500">{player.phone_number}</div>

                {/* Combined Club/Group Selector */}
                <div className="mt-2">
                    <label className="text-xs text-gray-600 block mb-1">Texting to:</label>
                    <select
                        value={activeToNumber}
                        onChange={(e) => onToNumberChange?.(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                        {clubs.map(club => (
                            <option key={club.club_id} value={club.phone_number}>
                                🏢 {club.name} (Club)
                            </option>
                        ))}
                        {groups.map(group => (
                            <option key={group.group_id} value={group.phone_number || ''}>
                                👥 {group.name} (Group)
                            </option>
                        ))}
                    </select>
                </div>
            </div>


            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm mt-8">
                        No messages yet
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.from === 'system' ? 'justify-start' : 'justify-end'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.from === 'system'
                                    ? 'bg-gray-100 text-gray-900'
                                    : 'bg-indigo-600 text-white'
                                    }`}
                            >
                                <div className="text-sm whitespace-pre-wrap break-words">{msg.text}</div>
                                <div className={`text-xs mt-1 ${msg.from === 'system' ? 'text-gray-500' : 'text-indigo-200'
                                    }`}>
                                    {msg.timestamp.toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Quick Actions */}
            <div className="p-2 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-wrap gap-1 mb-2">
                    <button
                        onClick={() => handleQuickAction('YES')}
                        className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium"
                    >
                        YES
                    </button>
                    <button
                        onClick={() => handleQuickAction('NO')}
                        className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium"
                    >
                        NO
                    </button>
                    <button
                        onClick={() => handleQuickAction('MAYBE')}
                        className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 font-medium"
                    >
                        MAYBE
                    </button>
                    <button
                        onClick={() => handleQuickAction('MATCHES')}
                        className="px-3 py-1 text-xs bg-cyan-100 text-cyan-800 rounded hover:bg-cyan-200 font-medium"
                    >
                        MATCHES
                    </button>
                    <button
                        onClick={() => handleQuickAction('NEXT')}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium"
                    >
                        NEXT
                    </button>
                    <button
                        onClick={() => handleQuickAction('HELP')}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium"
                    >
                        HELP
                    </button>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                    <button
                        onClick={() => handleQuickAction('PLAY')}
                        className="px-3 py-1 text-xs bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200 font-medium"
                    >
                        PLAY
                    </button>
                    <button
                        onClick={() => handleQuickAction('AVAILABLE')}
                        className="px-3 py-1 text-xs bg-teal-100 text-teal-800 rounded hover:bg-teal-200 font-medium"
                    >
                        AVAILABLE
                    </button>
                    <button
                        onClick={() => handleQuickAction('RATE')}
                        className="px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 font-medium"
                    >
                        RATE
                    </button>
                    <button
                        onClick={() => handleQuickAction('STATUS')}
                        className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200 font-medium"
                    >
                        STATUS
                    </button>
                    <button
                        onClick={() => handleQuickAction('CANCEL')}
                        className="px-3 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 font-medium"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={() => handleQuickAction('1')}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200 font-medium"
                    >
                        1
                    </button>
                    <button
                        onClick={() => handleQuickAction('2')}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200 font-medium"
                    >
                        2
                    </button>
                    <button
                        onClick={() => handleQuickAction('3')}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-800 rounded hover:bg-slate-200 font-medium"
                    >
                        3
                    </button>
                </div>

                {/* Text Input */}
                <div className="flex gap-1">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type message..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                        onClick={handleSend}
                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}
