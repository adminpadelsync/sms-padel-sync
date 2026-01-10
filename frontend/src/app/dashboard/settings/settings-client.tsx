'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { QrCode, ExternalLink, Phone, Search, CheckCircle2, Trash2, ArrowLeft } from 'lucide-react'
import { getAvailableNumbers, provisionClubNumber, releaseClubNumber } from '../clubs/actions'
import { authFetch } from '@/utils/auth-fetch'

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
        sms_test_mode?: boolean
        sms_whitelist?: string
        invite_timeout_minutes?: number
        initial_batch_size?: number
    } | null
}

interface SettingsClientProps {
    userClubId: string | null
}

export default function SettingsClient({ userClubId }: SettingsClientProps) {
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
        quiet_hours_end: 8,
        sms_test_mode: false,
        sms_whitelist: '',
        invite_timeout_minutes: 15,
        initial_batch_size: 6
    })

    const [twilioState, setTwilioState] = useState({
        isSearching: false,
        searchResults: [] as { phone_number: string, friendly_name: string }[],
        isProvisioning: false,
        isReleasing: false,
        error: ''
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
        if (userClubId) {
            fetchClub(userClubId)
        }
    }, [userClubId])

    const fetchClub = async (targetId: string) => {
        try {
            const response = await authFetch(`/api/clubs/${targetId}`)
            if (response.ok) {
                const data = (await response.json()) as { club: Club }
                const clubData = data.club

                if (clubData) {
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
                        quiet_hours_end: clubData.settings?.quiet_hours_end ?? 8,
                        sms_test_mode: clubData.settings?.sms_test_mode ?? false,
                        sms_whitelist: clubData.settings?.sms_whitelist ?? "",
                        invite_timeout_minutes: clubData.settings?.invite_timeout_minutes ?? 15,
                        initial_batch_size: clubData.settings?.initial_batch_size ?? 6
                    })
                }
            } else {
                const errorData = await response.json()
                console.error('Error response:', errorData)
                setMessage({ type: 'error', text: `Failed to load settings: ${errorData.detail || 'Unknown error'}` })
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
            const clubResponse = await authFetch(`/api/clubs/${club.club_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
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

            const settingsResponse = await authFetch(`/api/clubs/${club.club_id}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
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

    const handleSearchNumbers = async () => {
        if (!club) return
        setTwilioState(prev => ({ ...prev, isSearching: true, error: '' }))
        try {
            const phoneDigits = (formData.main_phone || '').replace(/\D/g, '')
            const areaCode = phoneDigits.length >= 3 ? phoneDigits.substring(0, 3) : '305'
            const data = (await getAvailableNumbers(areaCode)) as { success: boolean, numbers?: { phone_number: string, friendly_name: string }[] }
            setTwilioState(prev => ({ ...prev, searchResults: data.numbers || [] }))
        } catch (err) {
            const error = err as Error
            setTwilioState(prev => ({ ...prev, error: error.message || 'Failed to search numbers' }))
        } finally {
            setTwilioState(prev => ({ ...prev, isSearching: false }))
        }
    }

    const handleProvision = async (number: string) => {
        if (!club || !confirm(`Are you sure you want to provision ${number} for this club?`)) return
        setTwilioState(prev => ({ ...prev, isProvisioning: true, error: '' }))
        try {
            await provisionClubNumber(club.club_id, number)
            setFormData(prev => ({ ...prev, twilio_phone_number: number }))
            setTwilioState(prev => ({ ...prev, searchResults: [] }))
            setMessage({ type: 'success', text: `Provisioned ${number} successfully!` })
        } catch (err) {
            const error = err as Error
            setTwilioState(prev => ({ ...prev, error: error.message || 'Failed to provision' }))
        } finally {
            setTwilioState(prev => ({ ...prev, isProvisioning: false }))
        }
    }

    const handleRelease = async () => {
        if (!club || !confirm('Are you sure you want to release this number? This will stop all automated SMS for this club until a new number is provisioned.')) return
        setTwilioState(prev => ({ ...prev, isReleasing: true, error: '' }))
        try {
            await releaseClubNumber(club.club_id)
            setFormData(prev => ({ ...prev, twilio_phone_number: '' }))
            setMessage({ type: 'success', text: 'Number released successfully' })
        } catch (err) {
            const error = err as Error
            setTwilioState(prev => ({ ...prev, error: error.message || 'Failed to release' }))
        } finally {
            setTwilioState(prev => ({ ...prev, isReleasing: false }))
        }
    }

    const getBookingUrl = () => {
        const system = formData.booking_system.toLowerCase()
        const slug = formData.booking_slug
        if (system === 'playbypoint' && slug) {
            return `https://${slug}.playbypoint.com/book/${slug}`
        } else if (system === 'playtomic') {
            return 'https://playtomic.io'
        } else if (system === 'matchi') {
            return 'https://www.matchi.se'
        }
        if (system === 'playbypoint') {
            return 'https://playbypoint.com'
        }
        return null
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading settings...</div>
    if (!club) return <div className="min-h-screen flex items-center justify-center text-gray-500">No club found</div>

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href="/dashboard"
                            className="text-gray-500 hover:text-indigo-600 text-sm font-semibold mb-2 inline-flex items-center gap-2 group transition-all"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Club Settings</h1>
                        <p className="mt-2 text-lg text-gray-600">Manage your club profile and configurations.</p>
                    </div>
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
                    <section>
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                            Club Information
                        </h3>
                        <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Club Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4" />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Time Zone</label>
                                <select name="timezone" value={formData.timezone} onChange={handleChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4 bg-white" >
                                    {timezones.map(tz => (
                                        <option key={tz.id} value={tz.id}>{tz.name}</option>
                                    ))}
                                </select>
                            </div>
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
                                <select name="booking_system" value={formData.booking_system} onChange={handleChange} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4 bg-white" >
                                    {bookingSystems.map(sys => (
                                        <option key={sys.id} value={sys.id}>{sys.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-1">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-base font-bold text-gray-800">Club ID (for booking URL)</label>
                                    {getBookingUrl() && (
                                        <a href={getBookingUrl()!} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center" >
                                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                            Test Link
                                        </a>
                                    )}
                                </div>
                                <input type="text" name="booking_slug" value={formData.booking_slug} onChange={handleChange} placeholder="e.g. replay" className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4" />
                                <p className="mt-1 text-xs text-gray-500">Hint: Go to your booking page and look at the URL (e.g. replay.playbypoint.com)</p>
                            </div>
                            <div className="sm:col-span-2">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <label className="block text-base font-bold text-blue-900">Twilio Phone Number (Managed)</label>
                                            <p className="text-sm text-blue-700 mt-1">The automated system sends messages from this dedicated number.</p>
                                        </div>
                                        {formData.twilio_phone_number ? (
                                            <button type="button" onClick={handleRelease} disabled={twilioState.isReleasing} className="inline-flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50 focus:outline-none transition-colors disabled:opacity-50" >
                                                {twilioState.isReleasing ? 'Releasing...' : (
                                                    <>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Release Number
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <button type="button" onClick={handleSearchNumbers} disabled={twilioState.isSearching} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 focus:outline-none transition-colors disabled:opacity-50" >
                                                {twilioState.isSearching ? 'Searching...' : (
                                                    <>
                                                        <Search className="mr-2 h-4 w-4" />
                                                        Provision Number
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    {twilioState.error && (
                                        <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg">⚠️ {twilioState.error}</div>
                                    )}
                                    {formData.twilio_phone_number ? (
                                        <div className="flex items-center p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
                                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Active Number</p>
                                                <p className="text-lg font-bold text-gray-900">{formData.twilio_phone_number}</p>
                                            </div>
                                        </div>
                                    ) : twilioState.searchResults.length > 0 ? (
                                        <div className="mt-4">
                                            <p className="text-sm font-bold text-blue-900 mb-3">Available local numbers:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {twilioState.searchResults.map((num) => (
                                                    <button key={num.phone_number} type="button" onClick={() => handleProvision(num.phone_number)} disabled={twilioState.isProvisioning} className="px-4 py-3 bg-white border border-blue-200 rounded-lg text-sm font-medium text-blue-900 hover:border-blue-500 hover:bg-blue-50 transition-all text-center disabled:opacity-50" >{num.friendly_name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : !twilioState.isSearching && (
                                        <div className="flex items-center p-4 bg-blue-100/50 rounded-lg border border-blue-100">
                                            <Phone className="h-5 w-5 text-blue-600 mr-3 shrink-0" />
                                            <p className="text-sm text-blue-800">No active number. Provision a new one to enable automated SMS services.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

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

                    <section>
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                            Matchmaking & Messaging
                        </h3>

                        <div className="mb-10">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Matchmaking Configuration</h4>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">Control how the automated matchmaker invites players and handles timeouts.</p>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Batch Size</label>
                                    <input type="number" value={feedbackSettings.initial_batch_size} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, initial_batch_size: parseInt(e.target.value) || 0 }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4" />
                                    <p className="mt-1 text-xs text-gray-500">Number of players to invite in the first round (for &quot;Everyone&quot; matches).</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Wait Time Between Batches (Minutes)</label>
                                    <input type="number" value={feedbackSettings.invite_timeout_minutes} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, invite_timeout_minutes: parseInt(e.target.value) || 0 }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4" />
                                    <p className="mt-1 text-xs text-gray-500">Time before the next batch of players is invited if the match isn&apos;t full. Existing invitations don&apos;t expire.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10 pt-6 border-t border-gray-100">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">SMS Quiet Hours</h4>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">Prevent proactive messages (Match Invites, Feedback) from being sent during these times.</p>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours Start</label>
                                    <select value={feedbackSettings.quiet_hours_start} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, quiet_hours_start: parseInt(e.target.value) }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 bg-white" >
                                        {hours.map(h => (
                                            <option key={h} value={h}>{formatHour(h)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours End</label>
                                    <select value={feedbackSettings.quiet_hours_end} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, quiet_hours_end: parseInt(e.target.value) }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 bg-white" >
                                        {hours.map(h => (
                                            <option key={h} value={h}>{formatHour(h)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10 pt-6 border-t border-gray-100">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Feedback Collection</h4>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">Configure post-match feedback collection delays.</p>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Request (Hours)</label>
                                    <input type="number" step="0.5" value={feedbackSettings.feedback_delay_hours} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, feedback_delay_hours: parseFloat(e.target.value) || 0 }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4" />
                                    <p className="mt-1 text-xs text-gray-500">Wait time after match ends.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Nudge (Hours)</label>
                                    <input type="number" step="0.5" value={feedbackSettings.feedback_reminder_delay_hours} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, feedback_reminder_delay_hours: parseFloat(e.target.value) || 0 }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4" />
                                    <p className="mt-1 text-xs text-gray-500">Wait time after first request.</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">System Configuration</h4>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div>
                                        <h5 className="font-bold text-gray-900">SMS Live Mode</h5>
                                        <p className="text-xs text-gray-500 mt-1">{feedbackSettings.sms_test_mode ? "Test Mode: Outbox only." : "Live Mode: Real SMS."}</p>
                                    </div>
                                    <button type="button" onClick={() => setFeedbackSettings(prev => ({ ...prev, sms_test_mode: !prev.sms_test_mode }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${!feedbackSettings.sms_test_mode ? 'bg-green-500' : 'bg-gray-200'}`} >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!feedbackSettings.sms_test_mode ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SMS Whitelist (Optional)</label>
                                    <textarea value={feedbackSettings.sms_whitelist} onChange={(e) => setFeedbackSettings(prev => ({ ...prev, sms_whitelist: e.target.value }))} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 font-mono text-sm" placeholder="+15551234567, +15559876543" rows={2} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-end pt-6 border-t border-gray-100">
                        <button type="button" onClick={handleSave} disabled={saving} className={`inline-flex items-center px-8 py-3 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all ${saving ? 'opacity-70' : ''}`} >{saving ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                    {message && (
                        <div className={`mt-4 p-4 rounded-lg text-center ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{message.text}</div>
                    )}
                </div>
            </div>
        </div>
    )
}
