'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClub } from '../actions'
import { ChevronRight } from 'lucide-react'

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
        twilio_phone_number: '',
        court_count: 4
    })

    const bookingSystems = [
        { id: 'playtomic', name: 'Playtomic' },
        { id: 'playbypoint', name: 'PlayByPoint' },
        { id: 'other', name: 'Other' }
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
                address: fullAddress
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

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center"
                    >
                        ← Back to Dashboard
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

                        {/* Section: System Integration */}
                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                                Integration
                            </h3>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 sm:col-span-2 mb-6">
                                <label htmlFor="twilio_phone_number" className="block text-base font-bold text-blue-900 mb-2">
                                    Twilio Phone Number (Active)
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <input
                                        type="tel"
                                        name="twilio_phone_number"
                                        id="twilio_phone_number"
                                        required
                                        placeholder="+1..."
                                        value={formData.twilio_phone_number}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border-blue-200 text-blue-900 placeholder-blue-300 focus:ring-blue-500 focus:border-blue-500 text-lg py-3 px-4"
                                    />
                                </div>
                                <p className="mt-2 text-sm text-blue-700 flex items-center">
                                    ℹ️ Must be formatted as <span className="font-mono font-bold mx-1">+1XXXXXXXXXX</span> (e.g., +13051234567).
                                </p>
                            </div>
                        </section>

                        <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => router.back()}
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
