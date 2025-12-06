export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto py-12 px-6 prose dark:prose-invert">
            <h1>Privacy Policy</h1>
            <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>

            <h2>1. Information We Collect</h2>
            <p>
                We collect your phone number and name when you opt-in to our service via text message or
                verbal consent at your club. We use this information solely to send you match invitations
                and service updates.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>
                We use your information to:
                <ul>
                    <li>Send SMS notifications about upcoming padel matches.</li>
                    <li>Coordinate match scheduling and player availability.</li>
                    <li>Respond to your support requests.</li>
                </ul>
            </p>

            <h2>3. Information Sharing</h2>
            <p>
                <strong>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes.</strong>
                All other categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
            </p>

            <h2>4. Data Security</h2>
            <p>
                We implement reasonable security measures to protect your personal information from unauthorized
                access, alteration, disclosure, or destruction.
            </p>

            <h2>5. Your Choices</h2>
            <p>
                You can opt-out of receiving SMS messages at any time by replying <strong>STOP</strong> to any message we send.
            </p>

            <h2>6. Contact Us</h2>
            <p>
                If you have any questions about this Privacy Policy, please contact us at support@padelsync.com.
            </p>
        </div>
    );
}
