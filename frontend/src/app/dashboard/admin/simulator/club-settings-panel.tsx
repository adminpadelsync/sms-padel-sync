'use client'

import { useState, useEffect } from 'react'

interface ClubSettings {
    feedback_delay_hours: number
    feedback_reminder_delay_hours: number
}

interface ClubSettingsPanelProps {
    clubId: string
}

export function ClubSettingsPanel({ clubId }: ClubSettingsPanelProps) {
    const [settings, setSettings] = useState<ClubSettings>({
        feedback_delay_hours: 3,
        feedback_reminder_delay_hours: 4
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (clubId) {
            fetchSettings()
        }
    }, [clubId])

    const fetchSettings = async () => {
        try {
            const response = await fetch(`/api/clubs/${clubId}/settings`)
            if (response.ok) {
                const data = await response.json()
                setSettings(data)
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setMessage(null)
        try {
            const response = await fetch(`/api/clubs/${clubId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })
            if (response.ok) {
                setMessage('Settings saved successfully!')
                setTimeout(() => setMessage(null), 3000)
            } else {
                setMessage('Failed to save settings')
            }
        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="text-gray-500 text-sm">Loading settings...</div>
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Feedback Settings</h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours after match begins to send follow-up feedback
                    </label>
                    <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="24"
                        value={settings.feedback_delay_hours}
                        onChange={(e) => setSettings({
                            ...settings,
                            feedback_delay_hours: parseFloat(e.target.value) || 3
                        })}
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-500">hours (default: 3)</span>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours after initial request to send reminder (if no response)
                    </label>
                    <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="48"
                        value={settings.feedback_reminder_delay_hours}
                        onChange={(e) => setSettings({
                            ...settings,
                            feedback_reminder_delay_hours: parseFloat(e.target.value) || 4
                        })}
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-500">hours (default: 4)</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                    {message && (
                        <span className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                            {message}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
