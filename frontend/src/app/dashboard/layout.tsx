'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from './logout-button'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isHovering, setIsHovering] = useState(false)

    // Load collapsed state from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
        if (saved !== null) {
            setIsCollapsed(JSON.parse(saved))
        }
    }, [])

    // Persist collapsed state
    const toggleCollapsed = () => {
        const newState = !isCollapsed
        setIsCollapsed(newState)
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(newState))
    }

    const navigation = [
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            name: 'Matches',
            href: '/dashboard/matches',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            name: 'Groups',
            href: '/dashboard/groups',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        },
        {
            name: 'Settings',
            href: '/dashboard/settings',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
    ]

    // Determine if sidebar should appear expanded (either not collapsed, or hovering when collapsed)
    const showExpanded = !isCollapsed || isHovering

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <div
                className={`hidden md:flex md:flex-col fixed inset-y-0 z-50 transition-all duration-300 ease-in-out ${showExpanded ? 'md:w-64' : 'md:w-16'
                    }`}
                onMouseEnter={() => isCollapsed && setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div className="flex flex-col flex-grow border-r border-gray-200 bg-white overflow-y-auto overflow-x-hidden">
                    {/* Header with Logo and Toggle */}
                    <div className="flex items-center justify-between flex-shrink-0 px-3 h-16 border-b border-gray-200">
                        <div className={`flex items-center overflow-hidden transition-opacity duration-200 ${showExpanded ? 'opacity-100' : 'opacity-0'}`}>
                            <span className="text-xl font-bold text-indigo-600 whitespace-nowrap">Padel Sync</span>
                        </div>
                        <button
                            onClick={toggleCollapsed}
                            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
                            title={isCollapsed && isHovering ? 'Pin sidebar open' : isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {/* Show pin icon when hovering on collapsed sidebar (peek mode) */}
                            {isCollapsed && isHovering ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                            ) : (
                                <svg
                                    className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex-grow mt-5 flex flex-col">
                        <nav className="flex-1 px-2 space-y-1">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`group flex items-center px-2 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                                            ? 'bg-indigo-50 text-indigo-600'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                        title={!showExpanded ? item.name : undefined}
                                    >
                                        <span className="flex-shrink-0">{item.icon}</span>
                                        <span className={`ml-3 whitespace-nowrap transition-opacity duration-200 ${showExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                                            {item.name}
                                        </span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Logout Button at Bottom */}
                    <div className={`flex-shrink-0 border-t border-gray-200 p-3`}>
                        {showExpanded ? (
                            <LogoutButton />
                        ) : (
                            <form action="/auth/signout" method="post" className="flex justify-center">
                                <button
                                    type="submit"
                                    className="p-2 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                    title="Logout"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isCollapsed && !isHovering ? 'md:pl-16' : 'md:pl-64'
                }`}>
                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    )
}
