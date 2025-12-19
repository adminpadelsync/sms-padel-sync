import Link from 'next/link';

export default function MessagingTermsPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
                <div className="container mx-auto px-4 md:px-6 h-16 flex items-center">
                    <Link href="/" className="font-bold text-xl tracking-tight">
                        <span className="text-primary">Padel Sync</span>
                    </Link>
                </div>
            </header>

            <main className="flex-1 py-12 px-6">
                <div className="max-w-3xl mx-auto prose dark:prose-invert">
                    <h1>Messaging Terms & Conditions</h1>
                    <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>

                    <section className="mt-8">
                        <h2>1. Program Description</h2>
                        <p>
                            Padel Sync provides an automated SMS-based matchmaking service for Padel players. By signing up for our waitlist or registering via our platform, you are opting in to receive text messages from Padel Sync regarding match invitations, match confirmations, scheduling updates, and post-match feedback requests.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2>2. Message Frequency</h2>
                        <p>
                            Message frequency varies based on your match activity and availability settings. You can expect to receive messages when new match opportunities arise or when there are updates to matches you are participating in.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2>3. Cost</h2>
                        <p>
                            Message and data rates may apply for any messages sent to you from us and to us from you. If you have any questions about your text plan or data plan, it is best to contact your wireless provider.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2>4. Support & HELP</h2>
                        <p>
                            For support or more information, you can text <strong>HELP</strong> to our number or email us at <a href="mailto:adam@padelsync.com">adam@padelsync.com</a>.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2>5. Opt-Out & STOP</h2>
                        <p>
                            You can cancel the SMS service at any time. Just text <strong>STOP</strong> to our number. After you send the SMS message <strong>STOP</strong> to us, we will send you an SMS message to confirm that you have been unsubscribed. After this, you will no longer receive SMS messages from us. If you want to join again, just sign up as you did the first time, or text <strong>START</strong>, and we will start sending SMS messages to you again.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2>6. Privacy</h2>
                        <p>
                            Your phone number and personal data are used solely for the purpose of organizing Padel matches and will not be shared with third parties for marketing purposes. Please review our <Link href="/privacy">Privacy Policy</Link> for more details.
                        </p>
                    </section>
                </div>
            </main>

            <footer className="py-12 border-t bg-muted/30">
                <div className="container mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} Padel Sync. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
