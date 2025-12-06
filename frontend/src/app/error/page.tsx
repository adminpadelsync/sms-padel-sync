export default async function ErrorPage({
    searchParams,
}: {
    searchParams: Promise<{ message?: string }>
}) {
    const { message } = await searchParams
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Something went wrong
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    {message || 'There was an error processing your request. Please try again.'}
                </p>
                <div className="mt-6 text-center">
                    <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                        Back to login
                    </a>
                </div>
            </div>
        </div>
    )
}
