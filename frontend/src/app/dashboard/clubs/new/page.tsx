'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClub } from '../actions'

export default function NewClubPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState({
        name: '',
        address: '',
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

        try {
            const result = await createClub(formData)
            if (result.success && result.clubId) {
                // Redirect to the poster page
                router.push(`/dashboard/clubs/${result.clubId}/poster`)
            }
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : 'Failed to create club')
        } finally {
            setIsLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'court_count' ? parseInt(value) || 0 : value
        }))
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                            Provision New Club
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            Create a new club entity, setup courts, and configure admin details.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6 space-y-6">
                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <span className="text-red-400">⚠️</span>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">
                                            Error creating club
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{error}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            {/* Club Name */}
                            <div className="sm:col-span-4">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                    Club Name
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="text"
                                        name="name"
                                        id="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>
                            </div>

                            {/* Booking System */}
                            <div className="sm:col-span-2">
                                <label htmlFor="booking_system" className="block text-sm font-medium text-gray-700">
                                    Booking System
                                </label>
                                <div className="mt-1">
                                    <select
                                        id="booking_system"
                                        name="booking_system"
                                        value={formData.booking_system}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    >
                                        {bookingSystems.map(sys => (
                                            <option key={sys.id} value={sys.id}>{sys.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="sm:col-span-6">
                                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                                    Address
                                </label>
                                <div className="mt-1">
                                    <textarea
                                        id="address"
                                        name="address"
                                        rows={3}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                                        value={formData.address}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-6 border-t border-gray-200 pt-6">
                                <h4 className="text-sm font-medium text-gray-900 mb-4">Contact Information</h4>
                            </div>

                            {/* Main Phone */}
                            <div className="sm:col-span-3">
                                <label htmlFor="main_phone" className="block text-sm font-medium text-gray-700">
                                    Main Club Phone
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="tel"
                                        name="main_phone"
                                        id="main_phone"
                                        value={formData.main_phone}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>
                            </div>

                            {/* POC Name */}
                            <div className="sm:col-span-3">
                                <label htmlFor="poc_name" className="block text-sm font-medium text-gray-700">
                                    Point of Contact Name
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="text"
                                        name="poc_name"
                                        id="poc_name"
                                        value={formData.poc_name}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>
                            </div>

                            {/* POC Phone */}
                            <div className="sm:col-span-3">
                                <label htmlFor="poc_phone" className="block text-sm font-medium text-gray-700">
                                    POC Phone
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="tel"
                                        name="poc_phone"
                                        id="poc_phone"
                                        value={formData.poc_phone}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-6 border-t border-gray-200 pt-6">
                                <h4 className="text-sm font-medium text-gray-900 mb-4">System Integration</h4>
                            </div>

                            {/* Twilio Number */}
                            <div className="sm:col-span-3">
                                <label htmlFor="twilio_phone_number" className="block text-sm font-medium text-gray-700">
                                    Twilio Phone Number (Active)
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="tel"
                                        name="twilio_phone_number"
                                        id="twilio_phone_number"
                                        required
                                        placeholder="+1..."
                                        value={formData.twilio_phone_number}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Must be an active Twilio number configured with the webhook.</p>
                            </div>

                            {/* Court Count */}
                            <div className="sm:col-span-3">
                                <label htmlFor="court_count" className="block text-sm font-medium text-gray-700">
                                    Number of Courts
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="number"
                                        name="court_count"
                                        id="court_count"
                                        min="1"
                                        required
                                        value={formData.court_count}
                                        onChange={handleChange}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? 'Creating...' : 'Create Club'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
