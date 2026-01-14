'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/utils/supabase/client'

interface Club {
    club_id: string
    name: string
    phone_number: string
    address: string
    main_phone: string
}

export default function ClubPosterPage() {
    const params = useParams()
    const clubId = params.clubId as string
    const [club, setClub] = useState<Club | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchClub() {
            const supabase = createClient()
            const { data } = await supabase
                .from('clubs')
                .select('*')
                .eq('club_id', clubId)
                .single()

            if (data) setClub(data)
            setLoading(false)
        }
        if (clubId) fetchClub()
    }, [clubId])

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
    if (!club) return <div className="min-h-screen flex items-center justify-center">Club not found</div>

    const smsBody = "START"
    const smsLink = `sms:${club.phone_number}${navigator.userAgent.match(/iPhone|iPad|iPod/i) ? '&' : '?'}body=${smsBody}`

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            {/* Poster Card */}
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden print:shadow-none print:max-w-none print:w-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-10 text-center text-white">
                    <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {club.name}
                    </h1>
                    <p className="mt-2 text-indigo-100 text-lg font-medium">
                        Join our Padel Community!
                    </p>
                </div>

                {/* QR Section */}
                <div className="px-8 py-12 flex flex-col items-center text-center">
                    <div className="bg-white p-4 rounded-xl shadow-inner border-4 border-indigo-50">
                        <QRCodeSVG
                            value={smsLink}
                            size={256}
                            level="H"
                            includeMargin={true}
                        />
                    </div>

                    <h2 className="mt-8 text-2xl font-bold text-gray-900">
                        Scan to Sign Up
                    </h2>
                    <p className="mt-2 text-gray-600">
                        Get match invites and find players at your level.
                    </p>

                    <div className="mt-8 w-full border-t border-gray-200 pt-8">
                        <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-2">
                            Or text manually
                        </p>
                        <div className="bg-gray-50 rounded-lg p-4 inline-block">
                            <p className="text-xl font-mono font-bold text-gray-800">
                                Text <span className="text-indigo-600">START</span> to
                            </p>
                            <p className="text-2xl font-mono font-bold text-gray-900 mt-1">
                                {club.phone_number}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="bg-gray-50 px-8 py-6 text-center border-t border-gray-200">
                    <p className="text-sm text-gray-500">
                        {club.address}
                    </p>
                    {club.main_phone && (
                        <p className="text-sm text-gray-500 mt-1">
                            {club.main_phone}
                        </p>
                    )}
                </div>
            </div>

            {/* Action Buttons (Hide on print) */}
            <div className="mt-8 flex gap-4 print:hidden">
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    🖨️ Print Poster
                </button>
                <a
                    href="/dashboard/settings"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                    Back to Settings
                </a>
            </div>
        </div>
    )
}
