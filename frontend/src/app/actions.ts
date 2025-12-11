'use server'

export async function submitContactForm(prevState: any, formData: FormData) {
    const email = formData.get('email')

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (!email || typeof email !== 'string') {
        return { message: 'Please enter a valid email.', success: false }
    }

    // Log the email (simulate sending)
    console.log(`[Contact Form] New submission: ${email}`)

    // In a real app, you would send an email here using Resend, SendGrid, etc.

    return { message: "Thanks! We've added you to the list.", success: true }
}
