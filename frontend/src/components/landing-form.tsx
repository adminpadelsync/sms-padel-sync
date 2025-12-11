'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitContactForm } from '@/app/actions'
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react'

const initialState = {
    message: '',
    success: false,
}

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 min-w-[140px]"
        >
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                </>
            ) : (
                <>
                    Join Waitlist
                    <ArrowRight className="ml-2 h-4 w-4" />
                </>
            )}
        </button>
    )
}

export function ContactForm() {
    const [state, formAction] = useActionState(submitContactForm, initialState)

    if (state.success) {
        return (
            <div className="bg-background/10 backdrop-blur-sm p-8 rounded-2xl max-w-md mx-auto border border-primary-foreground/20 animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center text-center text-primary-foreground">
                    <div className="h-12 w-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">You're on the list!</h3>
                    <p className="opacity-90">{state.message}</p>
                    <p className="text-sm mt-4 opacity-70">We'll be in touch soon.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-background/10 backdrop-blur-sm p-8 rounded-2xl max-w-md mx-auto border border-primary-foreground/20">
            <h3 className="text-2xl font-bold mb-2 text-primary-foreground">Join the Waiting List</h3>
            <p className="text-primary-foreground/80 mb-6">
                Enter your email to get early access and start organizing matches.
            </p>

            <form action={formAction} className="space-y-4">
                <div>
                    <label htmlFor="email" className="sr-only">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="w-full h-12 px-4 rounded-md border-0 bg-background/90 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 shadow-sm"
                        placeholder="adam@padelsync.com"
                    />
                </div>

                {state.message && !state.success && (
                    <p className="text-red-300 text-sm bg-red-900/20 p-2 rounded">{state.message}</p>
                )}

                <div className="flex justify-center">
                    <SubmitButton />
                </div>
            </form>
            <p className="text-xs text-center text-primary-foreground/60 mt-4">
                No spam, just updates. Unsubscribe anytime.
            </p>
        </div>
    )
}
