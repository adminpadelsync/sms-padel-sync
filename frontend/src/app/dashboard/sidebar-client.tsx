'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from './logout-button'
import { SwitchClubModal } from './switch-club-modal'
import { Building2, ChevronLeft, LayoutDashboard, Users2, Users as GroupsIcon, CalendarDays, Trophy, Settings, ShieldCheck, Pin, Menu, X, LogOut } from 'lucide-react'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

interface SidebarClientProps {
    userClub: {
        club_id: string | null
        club_name: string | null
        is_superuser: boolean
    }
    clubs: { club_id: string; name: string }[]
    children: React.ReactNode
    initialCollapsed?: boolean
}

export function SidebarClient({ userClub, clubs, children, initialCollapsed = false }: SidebarClientProps) {
    const pathname = usePathname()
    const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
    const [isHovering, setIsHovering] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false)


    // Persist collapsed state
    const toggleCollapsed = () => {
        const newState = !isCollapsed
        setIsCollapsed(newState)
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(newState))
        // Set cookie so server knows on next request
        document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${newState}; path=/; max-age=31536000`
    }

    const navigation = [
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: <LayoutDashboard className="w-5 h-5" />
        },
        {
            name: 'Players',
            href: '/dashboard/players',
            icon: <Users2 className="w-5 h-5" />
        },
        {
            name: 'Groups',
            href: '/dashboard/groups',
            icon: <GroupsIcon className="w-5 h-5" />
        },
        {
            name: 'Matches',
            href: '/dashboard/matches',
            icon: <CalendarDays className="w-5 h-5" />
        },
        {
            name: 'Rankings',
            href: '/dashboard/rankings',
            icon: <Trophy className="w-5 h-5" />
        },
        {
            name: 'Settings',
            href: '/dashboard/settings',
            icon: <Settings className="w-5 h-5" />
        },
        {
            name: 'Admin',
            href: '/dashboard/admin',
            icon: <ShieldCheck className="w-5 h-5" />
        },
    ]

    // Determine if sidebar should appear expanded (either not collapsed, or hovering when collapsed)
    const showExpanded = !isCollapsed || isHovering

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between h-16 px-4 border-b border-gray-200 bg-white sticky top-0 z-50 w-full">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
                    <span className="text-lg font-bold text-indigo-600 truncate min-w-0">{userClub.club_name || 'Padel Sync'}</span>
                    {userClub.is_superuser && (
                        <button
                            onClick={() => setIsSwitchModalOpen(true)}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-lg transition-all duration-200 active:scale-95"
                            title="Switch Club"
                        >
                            <Building2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[60] bg-gray-600 bg-opacity-75 transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <div
                className={`md:hidden fixed inset-y-0 left-0 z-[70] w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    <div className="px-4 py-6 border-b border-gray-200">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                                <span className="text-xl font-bold text-indigo-600 leading-tight">{userClub.club_name || 'Padel Sync'}</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            {userClub.is_superuser && (
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        setIsSwitchModalOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-indigo-50 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-100 transition-all active:scale-[0.98]"
                                >
                                    <Building2 className="w-5 h-5" />
                                    <span>Switch Club</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <nav className="flex-grow mt-5 px-2 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`group flex items-center px-2 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <span className="flex-shrink-0">{item.icon}</span>
                                    <span className="ml-3">{item.name}</span>
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="flex-shrink-0 border-t border-gray-200 p-4">
                        <LogoutButton />
                    </div>
                </div>
            </div>

            {/* Desktop Sidebar */}
            <div
                className={`hidden md:flex md:flex-col fixed inset-y-0 z-50 transition-all duration-300 ease-in-out ${showExpanded ? 'md:w-64' : 'md:w-16'
                    }`}
                onMouseEnter={() => isCollapsed && setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div className="flex flex-col flex-grow border-r border-gray-200 bg-white overflow-y-auto overflow-x-hidden">
                    {/* Header with Logo and Toggle */}
                    <div className={`flex flex-col flex-shrink-0 border-b border-gray-200 transition-all duration-300 ${showExpanded ? 'p-4' : 'h-16 items-center justify-center'}`}>
                        {showExpanded ? (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between min-w-0">
                                    <span className="text-xl font-bold text-indigo-600 leading-tight break-words">
                                        {userClub.club_name || 'Padel Sync'}
                                    </span>
                                    <button
                                        onClick={toggleCollapsed}
                                        className="p-1.5 -mr-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                                        title="Collapse sidebar"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                </div>
                                {userClub.is_superuser && (
                                    <button
                                        onClick={() => setIsSwitchModalOpen(true)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all duration-200 active:scale-[0.98]"
                                        title="Switch Club"
                                    >
                                        <Building2 className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">Switch Club</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={toggleCollapsed}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                                title={isHovering ? 'Pin sidebar open' : 'Expand sidebar'}
                            >
                                {isHovering ? <Pin className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5 rotate-180" />}
                            </button>
                        )}
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
                                    className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
                                    title="Logout"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Main content wrapper */}
            <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isCollapsed && !isHovering ? 'md:pl-16' : 'md:pl-64'}`}>
                <main className="flex-1">
                    {children}
                </main>
            </div>

            <SwitchClubModal
                isOpen={isSwitchModalOpen}
                onClose={() => setIsSwitchModalOpen(false)}
                clubs={clubs}
                currentClubId={userClub.club_id}
            />
        </div>
    )
}
