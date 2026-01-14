'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { KeyRound, ShieldCheck, AlertCircle, Loader2, Zap } from 'lucide-react'

export default function SetupPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)

    const supabase = createClient()

    useEffect(() => {
        const handleAuth = async () => {
            console.log("[SetupAuth] Auth check started.")
            // 0. Log Full URL (Masking potentially sensitive token for screenshot safety if needed, but here we need to see it)
            // Removed sensitive log of full URL

            // 1. Manual Fallback: Parse Hash Fragment for Implicit Grant
            // Sometimes the SDK is too slow to pick up the hash on localhost
            const hash = window.location.hash
            if (hash && hash.includes('access_token=')) {
                console.log("[SetupAuth] MANUAL RECOVERY: Token found in hash. Forcing session...")
                try {
                    const params = new URLSearchParams(hash.substring(1)); // remove #
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        const { data, error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });

                        if (error) {
                            console.error(`[SetupAuth] Manual setSession failed: ${error.message}`);
                        } else if (data?.user) {
                            console.log(`[SetupAuth] SUCCESS: Manual session forced for ${data.user.email}`);
                            setUser(data.user);
                            setLoading(false);
                            // Clean hash from URL
                            window.history.replaceState(null, "", window.location.pathname);
                            return;
                        }
                    }
                } catch (e) {
                    console.error("[SetupAuth] Recovery error: " + e);
                }
            }

            // 2. Fallback check for PKCE/Cookies
            const { data: { session: initialSession } } = await supabase.auth.getSession()
            if (initialSession) {
                console.log(`[SetupAuth] SUCCESS: Active session detected for ${initialSession.user.email}`)
                setUser(initialSession.user)
                setLoading(false)
                return
            }

            // 3. Greedy Listener (handles late-arriving events)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                // console.log(`[SetupAuth] Auth Event: ${event} | Session: ${session ? 'YES' : 'NO'}`) // Removed verbose log
                if (session) {
                    setUser(session.user)
                    setError(null)
                    setLoading(false)
                }
            })

            // 4. Final timeout Wait
            const timeoutId = setTimeout(async () => {
                const { data: { session: finalSync } } = await supabase.auth.getSession()
                if (finalSync) {
                    console.log("[SetupAuth] Final sync found session.")
                    setUser(finalSync.user);
                    setLoading(false);
                } else {
                    console.error("[SetupAuth] CRITICAL: Failed to establish session after 6s.");
                    setError('Your session could not be established. Please try opening this link in an Incognito window to avoid account conflicts.');
                    setLoading(false);
                }
            }, 6000)

            return () => {
                subscription.unsubscribe()
                clearTimeout(timeoutId)
            }
        }

        handleAuth()
    }, [supabase])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!user) {
            setError('Auth session missing! Please refresh the page.')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setIsSaving(true)
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            })

            if (updateError) {
                setError(updateError.message)
            } else {
                // addLog("Password success! Redirecting...") // Removed verbose log
                router.push('/dashboard')
            }
        } catch (_err: unknown) {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <div className="text-center space-y-6">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto" />
                    <div className="space-y-2">
                        <p className="text-base font-bold text-gray-900">Synchronizing Session...</p>
                        <p className="text-xs text-gray-500 max-w-xs mx-auto">We detected your invitation token and are authorizing your browser.</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 shadow-sm border border-indigo-200">
                    <ShieldCheck className="h-10 w-10 text-indigo-600" />
                </div>
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
                    Welcome to PadelSync
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                    Authenticated as <span className="font-bold text-indigo-600">{user?.email || 'New User'}</span>. <br />
                    Finalize your account by setting a password below.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
                <div className="bg-white px-8 py-8 shadow-2xl border border-gray-100 sm:rounded-3xl">
                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        {error && (
                            <div className="flex flex-col gap-2 p-4 text-sm text-red-700 bg-red-50 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Session Error</span>
                                </div>
                                <p className="text-xs">{error}</p>
                            </div>
                        )}

                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                            <Zap className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                **Note**: Changing your password here will finalize your onboarding and allow you to log in to the dashboard.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 ml-1">
                                New Password
                            </label>
                            <div className="mt-1.5 relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <KeyRound className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="block w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm shadow-sm transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 ml-1">
                                Confirm New Password
                            </label>
                            <div className="mt-1.5 relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <KeyRound className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="block w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm shadow-sm transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex w-full justify-center items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Complete Account Setup"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
