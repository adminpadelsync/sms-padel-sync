'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { QrCode } from 'lucide-react'

interface Club {
    club_id: string
    name: string
    phone_number: string | null
    court_count: number
    address?: string
    poc_name?: string
    poc_phone?: string
    main_phone?: string
    booking_system?: string
    booking_slug?: string
    timezone?: string

    settings: {

        feedback_delay_hours?: number
        feedback_reminder_delay_hours?: number
        quiet_hours_start?: number
        quiet_hours_end?: number
    } | null
}

export default function SettingsPage() {
    const [club, setClub] = useState<Club | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        poc_name: '',
        poc_phone: '',
        main_phone: '',
        booking_system: 'playtomic',
        booking_slug: '',
        twilio_phone_number: '',
        timezone: 'America/New_York'
    })


    // Address broken down
    const [addressFields, setAddressFields] = useState({
        street: '',
        city: '',
        state: '',
        zip: ''
    })

    const [feedbackSettings, setFeedbackSettings] = useState({
        feedback_delay_hours: 3.0,
        feedback_reminder_delay_hours: 4.0,
        quiet_hours_start: 21,
        quiet_hours_end: 8
    })

    const bookingSystems = [
        { id: 'playtomic', name: 'Playtomic' },
        { id: 'matchi', name: 'Matchi' },
        { id: 'setteo', name: 'Setteo' },
        { id: 'playbypoint', name: 'Playbypoint' },
        { id: 'manual', name: 'Manual / Other' },
    ]

    const timezones = [
        { id: 'America/New_York', name: 'Eastern Time (ET)' },
        { id: 'America/Chicago', name: 'Central Time (CT)' },
        { id: 'America/Denver', name: 'Mountain Time (MT)' },
        { id: 'America/Los_Angeles', name: 'Pacific Time (PT)' },
        { id: 'America/Phoenix', name: 'Arizona (MST)' },
        { id: 'America/Anchorage', name: 'Alaska (AKT)' },
        { id: 'Pacific/Honolulu', name: 'Hawaii (HST)' },
    ]


    const formatHour = (hour: number) => {
        if (hour === 0) return '12 AM'
        if (hour === 12) return '12 PM'
        if (hour < 12) return `${hour} AM`
        return `${hour - 12} PM`
    }

    const hours = Array.from({ length: 24 }, (_, i) => i)
    useEffect(() => {
        const storedClubId = localStorage.getItem('selectedClubId')
        fetchClub(storedClubId)
    }, [])

    const fetchClub = async (targetId: string | null) => {
        try {
            const response = await fetch('/api/clubs')
            if (response.ok) {
                const data = await response.json()
                if (data.clubs && data.clubs.length > 0) {
                    // Find target club or default to first
                    let clubData = data.clubs[0]
                    if (targetId) {
                        const found = data.clubs.find((c: Club) => c.club_id === targetId)
                        if (found) clubData = found
                    }

                    setClub(clubData)

                    // Populate form
                    setFormData({
                        name: clubData.name || '',
                        poc_name: clubData.poc_name || '',
                        poc_phone: clubData.poc_phone || '',
                        main_phone: clubData.main_phone || '',
                        booking_system: clubData.booking_system || 'playtomic',
                        booking_slug: clubData.booking_slug || '',
                        twilio_phone_number: clubData.phone_number || '',
                        timezone: clubData.timezone || 'America/New_York',
                    })


                    // Parse address
                    if (clubData.address) {
                        // Simple parsing strategy: assume "Street, City, State Zip"
                        // This is a best-effort parse
                        const parts = clubData.address.split(',').map((s: string) => s.trim())
                        if (parts.length >= 3) {
                            const street = parts[0]
                            const city = parts[1]
                            const stateZip = parts[2]
                            const stateZipParts = stateZip.split(' ')
                            const state = stateZipParts[0]
                            const zip = stateZipParts.slice(1).join(' ')

                            setAddressFields({ street, city, state, zip })
                        } else {
                            // Fallback
                            setAddressFields({ street: clubData.address, city: '', state: '', zip: '' })
                        }
                    } else {
                        setAddressFields({ street: '', city: '', state: '', zip: '' })
                    }

                    // Populate settings
                    setFeedbackSettings({
                        feedback_delay_hours: clubData.settings?.feedback_delay_hours ?? 3.0,
                        feedback_reminder_delay_hours: clubData.settings?.feedback_reminder_delay_hours ?? 4.0,
                        quiet_hours_start: clubData.settings?.quiet_hours_start ?? 21,
                        quiet_hours_end: clubData.settings?.quiet_hours_end ?? 8
                    })
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

        const fullAddress = `${addressFields.street}, ${addressFields.city}, ${addressFields.state} ${addressFields.zip}`

        try {
            // Update club info
            const clubResponse = await fetch(`/api/clubs/${club.club_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone_number: formData.twilio_phone_number || null,
                    address: fullAddress,
                    poc_name: formData.poc_name || null,
                    poc_phone: formData.poc_phone || null,
                    main_phone: formData.main_phone || null,
                    booking_system: formData.booking_system || null,
                    booking_slug: formData.booking_slug || null,
                    timezone: formData.timezone
                })

            })

            if (!clubResponse.ok) throw new Error('Failed to update club info')

            // Update club settings
            const settingsResponse = await fetch(`/api/clubs/${club.club_id}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedbackSettings)
            })

            if (!settingsResponse.ok) throw new Error('Failed to update settings')

            setMessage({ type: 'success', text: 'Settings saved successfully!' })
            setTimeout(() => setMessage(null), 3000)

        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setAddressFields(prev => ({ ...prev, [name]: value }))
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading settings...</div>
    if (!club) return <div className="min-h-screen flex items-center justify-center text-gray-500">No club found</div>

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center">
                            ← Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Club Settings</h1>
                        <p className="mt-2 text-lg text-gray-600">Manage your club profile and configurations.</p>
                    </div>

                    {/* Poster Link */}
                    <div className="mt-4 sm:mt-0">
                        <Link
                            href={`/dashboard/clubs/${club.club_id}/poster`}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <QrCode className="mr-2 h-5 w-5 text-indigo-600" />
                            View QR Poster
                        </Link>
                    </div>
                </div>

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 p-8 sm:p-10 space-y-10">

                    {/* 1. Club Information */}
                    <section>
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                            Club Information
                        </h3>
                        <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Club Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Time Zone</label>
                                <select
                                    name="timezone"
                                    value={formData.timezone}
                                    onChange={handleChange}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4 bg-white"
                                >
                                    {timezones.map(tz => (
                                        <option key={tz.id} value={tz.id}>{tz.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Address Breakdown */}
                            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-6 gap-6">
                                <div className="sm:col-span-6">
                                    <label className="block text-base font-bold text-gray-800 mb-2">Address</label>
                                    <input type="text" name="street" placeholder="Street" value={addressFields.street} onChange={handleAddressChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4 mb-4" />
                                </div>
                                <div className="sm:col-span-3">
                                    <input type="text" name="city" placeholder="City" value={addressFields.city} onChange={handleAddressChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4" />
                                </div>
                                <div className="sm:col-span-1">
                                    <input type="text" name="state" placeholder="State" value={addressFields.state} onChange={handleAddressChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4" />
                                </div>
                                <div className="sm:col-span-2">
                                    <input type="text" name="zip" placeholder="Zip" value={addressFields.zip} onChange={handleAddressChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4" />
                                </div>
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Main Club Phone</label>
                                <input type="text" name="main_phone" value={formData.main_phone} onChange={handleChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4" />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Booking System</label>
                                <select
                                    name="booking_system"
                                    value={formData.booking_system}
                                    onChange={handleChange}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4 bg-white"
                                >
                                    {bookingSystems.map(sys => (
                                        <option key={sys.id} value={sys.id}>{sys.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Club ID (for booking URL)</label>
                                <input
                                    type="text"
                                    name="booking_slug"
                                    value={formData.booking_slug}
                                    onChange={handleChange}
                                    placeholder="e.g. replay"
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                />
                                <p className="mt-1 text-xs text-gray-500">Hint: Go to your booking page and look at the URL (e.g. replay.playbypoint.com)</p>
                            </div>

                            <div className="sm:col-span-2">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                                    <label className="block text-base font-bold text-blue-900 mb-2">Twilio Phone Number</label>
                                    <input
                                        type="text"
                                        name="twilio_phone_number"
                                        value={formData.twilio_phone_number}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-blue-200 text-blue-900 placeholder-blue-300 focus:ring-blue-500 focus:border-blue-500 text-lg py-3 px-4"
                                    />
                                    <p className="mt-2 text-sm text-blue-700">ℹ️ The automated system sends messages from this number.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. Contact Information */}
                    <section>
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Contact Person Name</label>
                                <input type="text" name="poc_name" value={formData.poc_name} onChange={handleChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4" />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Contact Person Phone</label>
                                <input type="text" name="poc_phone" value={formData.poc_phone} onChange={handleChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4" />
                            </div>
                        </div>
                    </section>

                    {/* 3. Messaging & Feedback Settings */}
                    <section>
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                            Messaging & Feedback
                        </h3>

                        {/* Quiet Hours */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-gray-900">SMS Quiet Hours</h4>
                            </div>

                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                Quiet Hours prevent <strong>proactive</strong> messages like Match Invites and Feedback Requests from being sent during sleep times.
                                Immediate/reactive responses to user commands (like <code className="text-indigo-600 font-mono">PLAY</code>, <code className="text-indigo-600 font-mono">YES</code>, <code className="text-indigo-600 font-mono">MATCHES</code>) will always be sent 24/7.
                            </p>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours Start</label>
                                    <select
                                        value={feedbackSettings.quiet_hours_start}
                                        onChange={(e) => setFeedbackSettings(prev => ({ ...prev, quiet_hours_start: parseInt(e.target.value) }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 bg-white"
                                    >
                                        {hours.map(h => (
                                            <option key={h} value={h}>{formatHour(h)}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">Messages will stop being sent starting at this time.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours End</label>
                                    <select
                                        value={feedbackSettings.quiet_hours_end}
                                        onChange={(e) => setFeedbackSettings(prev => ({ ...prev, quiet_hours_end: parseInt(e.target.value) }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 bg-white"
                                    >
                                        {hours.map(h => (
                                            <option key={h} value={h}>{formatHour(h)}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">Messages will resume being sent at this time.</p>
                                </div>
                            </div>
                        </div>

                        {/* Feedback Delays */}
                        <div className="pt-6 border-t border-gray-100">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Feedback Settings</h4>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                Configure when the system collects feedback from players after a match is completed.
                            </p>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Request Delay (Hours)</label>
                                    <input
                                        type="number" step="0.5"
                                        value={feedbackSettings.feedback_delay_hours}
                                        onChange={(e) => setFeedbackSettings(prev => ({ ...prev, feedback_delay_hours: parseFloat(e.target.value) || 0 }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Hours to wait after a match ends before sending the initial feedback request.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Reminder Delay (Hours)</label>
                                    <input
                                        type="number" step="0.5"
                                        value={feedbackSettings.feedback_reminder_delay_hours}
                                        onChange={(e) => setFeedbackSettings(prev => ({ ...prev, feedback_reminder_delay_hours: parseFloat(e.target.value) || 0 }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Hours to wait after the initial request before sending a reminder if no response is received.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-end pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className={`inline-flex items-center px-8 py-3 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all ${saving ? 'opacity-70' : ''}`}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                    {message && (
                        <div className={`mt-4 p-4 rounded-lg text-center ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
