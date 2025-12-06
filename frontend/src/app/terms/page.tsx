export default function TermsPage() {
    return (
        <div className="max-w-3xl mx-auto py-12 px-6 prose dark:prose-invert">
            <h1>Terms of Service</h1>
            <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>

            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing Padel Sync or opting into our SMS service, you agree to be bound by these Terms of Service.
            </p>

            <h2>2. SMS Service Terms</h2>
            <p>
                <strong>Program Description:</strong> Padel Sync sends automated SMS match invitations and updates to registered players.
            </p>
            <p>
                <strong>Frequency:</strong> Message frequency varies based on match availability and your activity.
            </p>
            <p>
                <strong>Cost:</strong> Message and data rates may apply.
            </p>
            <p>
                <strong>Opt-Out:</strong> You can cancel the SMS service at any time. Just text "STOP" to the short code. After you send the SMS message "STOP" to us, we will send you an SMS message to confirm that you have been unsubscribed. After this, you will no longer receive SMS messages from us. If you want to join again, just sign up as you did the first time and we will start sending SMS messages to you again.
            </p>
            <p>
                <strong>Support:</strong> If you are experiencing issues with the messaging program you can reply with the keyword "HELP" for more assistance, or you can get help directly at support@padelsync.com.
            </p>
            <p>
                <strong>Carriers:</strong> Carriers are not liable for delayed or undelivered messages.
            </p>

            <h2>3. Limitation of Liability</h2>
            <p>
                Padel Sync is provided "as is" without warranties of any kind. We are not liable for missed matches or service interruptions.
            </p>
        </div>
    );
}
