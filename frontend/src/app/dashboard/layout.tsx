'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from './logout-button'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
        { name: 'Groups', href: '/dashboard/groups', icon: '👥' },
        { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ]

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <div className="hidden md:flex md:w-64 md:flex-col fixed inset-y-0 z-50">
                <div className="flex flex-col flex-grow border-r border-gray-200 bg-white overflow-y-auto">
                    <div className="flex items-center flex-shrink-0 px-4 h-16 border-b border-gray-200">
                        <span className="text-xl font-bold text-indigo-600">Padel Sync</span>
                    </div>
                    <div className="flex-grow mt-5 flex flex-col">
                        <nav className="flex-1 px-2 space-y-1">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                                                ? 'bg-indigo-50 text-indigo-600'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <span className="mr-3 text-lg">{item.icon}</span>
                                        {item.name}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>
                    <div className="flex-shrink-0 border-t border-gray-200 p-4">
                        <LogoutButton />
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="md:pl-64 flex flex-col flex-1">
                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    )
}
