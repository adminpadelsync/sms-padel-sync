'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Phone, Search, CheckCircle2 } from 'lucide-react'
import { createClub, getAvailableNumbers } from '../actions'

export default function NewClubPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Address broken down
    const [addressFields, setAddressFields] = useState({
        street: '',
        city: '',
        state: '',
        zip: ''
    })

    const [formData, setFormData] = useState({
        name: '',
        poc_name: '',
        poc_phone: '',
        main_phone: '',
        booking_system: 'playtomic',
        court_count: 4,
        timezone: 'America/New_York',
        admin_email: ''
    })

    const [twilioState, setTwilioState] = useState({
        isSearching: false,
        searchResults: [] as { phone_number: string, friendly_name: string }[],
        selectedNumber: '',
        error: ''
    })


    const bookingSystems = [
        { id: 'playtomic', name: 'Playtomic' },
        { id: 'playbypoint', name: 'PlayByPoint' },
        { id: 'other', name: 'Other' }
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


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        // Concatenate address
        const fullAddress = `${addressFields.street}, ${addressFields.city}, ${addressFields.state} ${addressFields.zip}`

        try {
            const result = await createClub({
                ...formData,
                address: fullAddress,
                selected_provision_number: twilioState.selectedNumber,
                admin_email: formData.admin_email
            })
            if (result.success && result.clubId) {
                router.push(`/dashboard/clubs/${result.clubId}/poster`)
            }
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : 'Failed to create club')
        } finally {
            setIsLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'court_count' ? parseInt(value) || 0 : value
        }))
    }

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setAddressFields(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSearchNumbers = async () => {
        if (!formData.main_phone) {
            setTwilioState(prev => ({ ...prev, error: 'Please enter a Main Club Phone number first to determine area code.' }))
            return
        }

        // Extract area code from main_phone (simple regex for (XXX) or XXX-)
        const phoneDigits = formData.main_phone.replace(/\D/g, '')
        const areaCode = phoneDigits.length >= 3 ? phoneDigits.substring(0, 3) : '305'

        setTwilioState(prev => ({ ...prev, isSearching: true, error: '' }))
        try {
            const { numbers } = await getAvailableNumbers(areaCode)
            setTwilioState(prev => ({ ...prev, searchResults: numbers }))
        } catch (err: any) {
            setTwilioState(prev => ({ ...prev, error: err.message || 'Failed to search numbers' }))
        } finally {
            setTwilioState(prev => ({ ...prev, isSearching: false }))
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard/admin')}
                        className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center"
                    >
                        ← Back to Admin
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Provision New Club</h1>
                    <p className="mt-2 text-lg text-gray-600">
                        Configure a new club entity, setup courts, and establish admin credentials.
                    </p>
                </div>

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <form onSubmit={handleSubmit} className="p-8 sm:p-10 space-y-10">
                        {error && (
                            <div className="rounded-xl bg-red-50 p-4 border border-red-100">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <span className="text-red-500 text-xl">⚠️</span>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-bold text-red-800">
                                            Creation Failed
                                        </h3>
                                        <div className="mt-1 text-sm text-red-700">
                                            <p>{error}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section: Club Details */}
                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                                Club Details
                            </h3>
                            <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label htmlFor="name" className="block text-base font-bold text-gray-800 mb-2">
                                        Club Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        id="name"
                                        required
                                        placeholder="e.g. Miami Padel Club"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                    />
                                </div>

                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-6 gap-6">
                                    <div className="sm:col-span-6">
                                        <label className="block text-base font-bold text-gray-800 mb-2">Address</label>
                                        <input
                                            type="text"
                                            name="street"
                                            placeholder="Street Address"
                                            required
                                            value={addressFields.street}
                                            onChange={handleAddressChange}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4 mb-4"
                                        />
                                    </div>
                                    <div className="sm:col-span-3">
                                        <input
                                            type="text"
                                            name="city"
                                            placeholder="City"
                                            required
                                            value={addressFields.city}
                                            onChange={handleAddressChange}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4"
                                        />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <input
                                            type="text"
                                            name="state"
                                            placeholder="State"
                                            required
                                            value={addressFields.state}
                                            onChange={handleAddressChange}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <input
                                            type="text"
                                            name="zip"
                                            placeholder="ZIP Code"
                                            required
                                            value={addressFields.zip}
                                            onChange={handleAddressChange}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-3 px-4"
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-1">
                                    <label htmlFor="booking_system" className="block text-base font-bold text-gray-800 mb-2">
                                        Booking System
                                    </label>
                                    <select
                                        id="booking_system"
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
                                    <label htmlFor="court_count" className="block text-base font-bold text-gray-800 mb-2">
                                        Number of Courts
                                    </label>
                                    <input
                                        type="number"
                                        name="court_count"
                                        id="court_count"
                                        min="1"
                                        required
                                        value={formData.court_count}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label htmlFor="timezone" className="block text-base font-bold text-gray-800 mb-2">
                                        Timezone
                                    </label>
                                    <select
                                        id="timezone"
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
                            </div>

                        </section>

                        {/* Section: Contact Details */}
                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                                Contact Information
                            </h3>
                            <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                                <div className="sm:col-span-1">
                                    <label htmlFor="poc_name" className="block text-base font-bold text-gray-800 mb-2">
                                        Point of Contact Name
                                    </label>
                                    <input
                                        type="text"
                                        name="poc_name"
                                        id="poc_name"
                                        placeholder="Full Name"
                                        value={formData.poc_name}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                    />
                                </div>

                                <div className="sm:col-span-1">
                                    <label htmlFor="poc_phone" className="block text-base font-bold text-gray-800 mb-2">
                                        POC Phone
                                    </label>
                                    <input
                                        type="tel"
                                        name="poc_phone"
                                        id="poc_phone"
                                        placeholder="(555) 123-4567"
                                        value={formData.poc_phone}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                    />
                                </div>

                                <div className="sm:col-span-1">
                                    <label htmlFor="main_phone" className="block text-base font-bold text-gray-800 mb-2">
                                        Main Club Phone
                                    </label>
                                    <input
                                        type="tel"
                                        name="main_phone"
                                        id="main_phone"
                                        placeholder="(555) 999-8888"
                                        value={formData.main_phone}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Section: Administrator Setup */}
                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                                Administrator Setup
                            </h3>
                            <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label htmlFor="admin_email" className="block text-base font-bold text-gray-800 mb-2">
                                        Initial Manager Email
                                    </label>
                                    <input
                                        type="email"
                                        name="admin_email"
                                        id="admin_email"
                                        placeholder="manager@example.com"
                                        value={formData.admin_email}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                                    />
                                    <p className="mt-2 text-sm text-gray-500">
                                        Assign an existing user as the first manager of this club. They will gain access immediately.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section: System Integration */}
                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">4</span>
                                Integration
                            </h3>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 sm:col-span-2 mb-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <label className="block text-base font-bold text-blue-900">
                                            Twilio Phone Number (Managed)
                                        </label>
                                        <p className="text-sm text-blue-700 mt-1">
                                            The system will provision a dedicated number for this club to handle match invitations and results.
                                        </p>
                                    </div>
                                    {!twilioState.selectedNumber && (
                                        <button
                                            type="button"
                                            onClick={handleSearchNumbers}
                                            disabled={twilioState.isSearching}
                                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 focus:outline-none transition-colors disabled:opacity-50"
                                        >
                                            {twilioState.isSearching ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Searching...
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="mr-2 h-4 w-4" />
                                                    Provision Number
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {twilioState.error && (
                                    <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg">
                                        ⚠️ {twilioState.error}
                                    </div>
                                )}

                                {twilioState.selectedNumber ? (
                                    <div className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Selected Number</p>
                                                <p className="text-lg font-bold text-gray-900">{twilioState.selectedNumber}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTwilioState(prev => ({ ...prev, selectedNumber: '', searchResults: [] }))}
                                            className="text-sm font-bold text-blue-600 hover:text-blue-800"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : twilioState.searchResults.length > 0 ? (
                                    <div className="mt-4">
                                        <p className="text-sm font-bold text-blue-900 mb-3">Available local numbers:</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {twilioState.searchResults.map((num) => (
                                                <button
                                                    key={num.phone_number}
                                                    type="button"
                                                    onClick={() => setTwilioState(prev => ({ ...prev, selectedNumber: num.phone_number }))}
                                                    className="px-4 py-3 bg-white border border-blue-200 rounded-lg text-sm font-medium text-blue-900 hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                                                >
                                                    {num.friendly_name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : !twilioState.isSearching && (
                                    <div className="flex items-center p-4 bg-blue-100/50 rounded-lg border border-blue-100">
                                        <Phone className="h-5 w-5 text-blue-600 mr-3 shrink-0" />
                                        <p className="text-sm text-blue-800">
                                            No number selected yet. Click "Provision Number" to find local options.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard/admin')}
                                className="px-6 py-3 border border-gray-300 rounded-xl shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`inline-flex items-center px-8 py-3 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:-translate-y-0.5 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        Create Club
                                        <ChevronRight className="ml-2 h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
