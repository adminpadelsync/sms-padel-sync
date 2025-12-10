'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Club {
    club_id: string
    name: string
    phone_number: string | null
    court_count: number
    settings: {
        feedback_delay_hours?: number
        feedback_reminder_delay_hours?: number
    } | null
}

export default function SettingsPage() {
    const router = useRouter()
    const [club, setClub] = useState<Club | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [feedbackDelayHours, setFeedbackDelayHours] = useState(3)
    const [feedbackReminderDelayHours, setFeedbackReminderDelayHours] = useState(4)

    useEffect(() => {
        fetchClub()
    }, [])

    const fetchClub = async () => {
        try {
            const response = await fetch('/api/clubs')
            if (response.ok) {
                const data = await response.json()
                if (data.clubs && data.clubs.length > 0) {
                    const clubData = data.clubs[0]
                    setClub(clubData)
                    setName(clubData.name || '')
                    setPhoneNumber(clubData.phone_number || '')
                    setFeedbackDelayHours(clubData.settings?.feedback_delay_hours ?? 3)
                    setFeedbackReminderDelayHours(clubData.settings?.feedback_reminder_delay_hours ?? 4)
                }
            }
        } catch (error) {
            console.error('Error fetching club:', error)
            setMessage({ type: 'error', text: 'Failed to load club settings' })
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!club) return

        setSaving(true)
        setMessage(null)

        try {
            // Update club info (name, phone_number)
            const clubResponse = await fetch(`/api/clubs/${club.club_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone_number: phoneNumber || null
                })
            })

            if (!clubResponse.ok) {
                throw new Error('Failed to update club info')
            }

            // Update club settings (feedback settings)
            const settingsResponse = await fetch(`/api/clubs/${club.club_id}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback_delay_hours: feedbackDelayHours,
                    feedback_reminder_delay_hours: feedbackReminderDelayHours
                })
            })

            if (!settingsResponse.ok) {
                throw new Error('Failed to update settings')
            }

            setMessage({ type: 'success', text: 'Settings saved successfully!' })
            setTimeout(() => setMessage(null), 3000)

        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <div className="text-gray-500">Loading settings...</div>
            </div>
        )
    }

    if (!club) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <div className="text-gray-500">No club found</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href="/dashboard"
                        className="text-indigo-600 hover:text-indigo-800 text-sm mb-2 inline-block"
                    >
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">⚙️ Club Settings</h1>
                    <p className="text-gray-600">Configure your club&apos;s SMS and notification settings</p>
                </div>

                {/* Settings Form */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                    {/* Club Information Section */}
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Club Information</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Club Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., Miami Padel Club"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    SMS Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="+18885550123"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    📱 Your Twilio phone number. Players who text this number will be registered with this club.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Feedback Settings Section */}
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Feedback Settings</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hours after match begins to send feedback request
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0.5"
                                        max="24"
                                        value={feedbackDelayHours}
                                        onChange={(e) => setFeedbackDelayHours(parseFloat(e.target.value) || 3)}
                                        className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <span className="text-sm text-gray-500">hours</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hours after initial request to send reminder
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0.5"
                                        max="48"
                                        value={feedbackReminderDelayHours}
                                        onChange={(e) => setFeedbackReminderDelayHours(parseFloat(e.target.value) || 4)}
                                        className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <span className="text-sm text-gray-500">hours (if no response)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="p-6 bg-gray-50">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>

                            {message && (
                                <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {message.text}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Help Text */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">💡 About SMS Phone Numbers</h3>
                    <p className="text-sm text-blue-800">
                        Each club should have its own dedicated Twilio phone number. When players text that number,
                        they&apos;ll automatically be registered with this club. You can get additional phone numbers from
                        your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">Twilio Console</a>.
                    </p>
                </div>
            </div>
        </div>
    )
}
