'use server'

import { createClient } from '@/utils/supabase/server'

export async function submitContactForm(prevState: unknown, formData: FormData) {
    const email = formData.get('email')

    // Simulate network delay for better UX feeling
    await new Promise(resolve => setTimeout(resolve, 800))

    if (!email || typeof email !== 'string') {
        return { message: 'Please enter a valid email.', success: false }
    }

    const supabase = await createClient()

    try {
        const { error } = await supabase
            .from('waitlist')
            .insert({ email })

        if (error) {
            console.error('Supabase error:', error)
            return { message: 'Something went wrong. Please try again.', success: false }
        }
    } catch (err) {
        console.error('Unexpected error:', err)
        return { message: 'Something went wrong. Please try again.', success: false }
    }

    // Log the email (simulate sending email notification)
    console.log(`[Contact Form] New submission saved to DB: ${email}`)

    return { message: "Thanks! We've added you to the list.", success: true }
}
