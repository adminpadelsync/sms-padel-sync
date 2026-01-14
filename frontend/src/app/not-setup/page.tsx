export default function NotSetupPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
                <div className="bg-white px-8 py-10 shadow-lg rounded-lg border border-gray-200">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                        Account Not Set Up
                    </h2>

                    <p className="text-gray-600 text-center mb-6">
                        Your account has been created, but it hasn&apos;t been associated with a club yet.
                    </p>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">For Superusers:</h3>
                        <p className="text-sm text-blue-800 mb-2">Run this command to make yourself a superuser:</p>
                        <code className="block bg-blue-100 text-blue-900 px-3 py-2 rounded text-xs font-mono">
                            python3 backend/setup_superuser.py your-email@example.com
                        </code>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">For Club Admins:</h3>
                        <p className="text-sm text-gray-700">
                            Contact your system administrator to have your account associated with your club.
                        </p>
                    </div>

                    <div className="mt-6 text-center">
                        <a href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                            ← Back to login
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
