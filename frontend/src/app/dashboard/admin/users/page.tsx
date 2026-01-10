'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { authFetch } from '@/utils/auth-fetch'
import {
    Users,
    Search,
    Filter,
    Shield,
    Building2,
    Edit2,
    X,
    Check,
    ChevronLeft,
    UserPlus,
    Mail,
    Trash2
} from 'lucide-react'

interface UserClubAssignment {
    user_id: string
    club_id: string
    role: string
}

interface User {
    user_id: string
    email: string
    role: 'superuser' | 'club_admin' | 'club_staff'
    is_superuser: boolean
    created_at: string
    clubs: UserClubAssignment[]
}

interface Club {
    club_id: string
    name: string
}

export default function UserManagementPage() {
    const router = useRouter()
    const [users, setUsers] = useState<User[]>([])
    const [clubs, setClubs] = useState<Club[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [invitePassword, setInvitePassword] = useState('PadelPass123!')
    const [selectedClubIds, setSelectedClubIds] = useState<string[]>([])
    const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
    const [isInviting, setIsInviting] = useState(false)

    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            console.log('Fetching user management data...')
            const [usersRes, clubsRes] = await Promise.all([
                authFetch('/api/admin/users'),
                authFetch('/api/clubs')
            ])

            console.log('Users Response:', usersRes.status, usersRes.statusText)
            console.log('Clubs Response:', clubsRes.status, clubsRes.statusText)

            if (!usersRes.ok || !clubsRes.ok) {
                const usersErr = !usersRes.ok ? await usersRes.text() : null
                const clubsErr = !clubsRes.ok ? await clubsRes.text() : null
                const msg = `Failed to fetch: ${usersErr || ''} ${clubsErr || ''}`.trim()
                setError(msg || 'Unauthorized or server error')
                return
            }

            const usersData = await usersRes.json()
            const clubsData = await clubsRes.json()

            console.log(`Loaded ${usersData.users?.length || 0} users and ${clubsData.clubs?.length || 0} clubs`)

            setUsers(usersData.users || [])
            setClubs(clubsData.clubs || [])
        } catch (err) {
            console.error('Error fetching data:', err)
            setError(err instanceof Error ? err.message : 'An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveAssignment = async (userId: string, clubIds: string[], role: string) => {
        setIsSaving(true)
        try {
            const res = await authFetch(`/api/admin/users/${userId}/clubs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ club_ids: clubIds, role })
            })

            if (res.ok) {
                setEditingUser(null)
                fetchData()
            } else {
                alert('Failed to update user assignments')
            }
        } catch (err) {
            console.error('Error saving assignment:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inviteEmail || !invitePassword) return

        setIsInviting(true)
        try {
            const res = await authFetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: inviteEmail,
                    password: invitePassword,
                    club_ids: selectedClubIds,
                    send_email: sendWelcomeEmail
                })
            })

            if (res.ok) {
                setIsInviteModalOpen(false)
                setInviteEmail('')
                setInvitePassword('PadelPass123!')
                setSelectedClubIds([])
                alert('User created successfully!')
                fetchData()
            } else {
                const errData = await res.json()
                alert(`Failed to create user: ${errData.detail || 'Unknown error'}`)
            }
        } catch (err) {
            console.error('Error creating user:', err)
        } finally {
            setIsInviting(false)
        }
    }

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`Are you sure you want to permanently delete ${email}? This cannot be undone.`)) return

        setIsSaving(true)
        try {
            const res = await authFetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                alert('User deleted successfully.')
                fetchData()
            } else {
                const errData = await res.json()
                alert(`Failed to delete user: ${errData.detail || 'Unknown error'}`)
            }
        } catch (err) {
            console.error('Error deleting user:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
            {error && (
                <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-600 animate-in fade-in slide-in-from-top-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black uppercase tracking-widest mb-1">Authorization Error</p>
                        <p className="text-sm opacity-80 font-bold">{error}</p>
                        <p className="text-[10px] mt-2 text-red-400 font-bold uppercase tracking-wider italic">
                            Check the Vercel logs for "DEBUG: Auth Error" to see more details.
                        </p>
                    </div>
                    <button
                        onClick={() => fetchData()}
                        className="px-4 py-2 bg-white text-red-600 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95"
                    >
                        Retry
                    </button>
                </div>
            )}
            <div className="mb-8">
                <button
                    onClick={() => router.push('/dashboard/admin')}
                    className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Admin
                </button>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            <Users className="w-8 h-8 text-indigo-600" />
                            User Management
                        </h1>
                        <p className="mt-2 text-lg text-gray-600">
                            Manage access and permissions for all staff and administrators.
                        </p>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by email or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex gap-2">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {filteredUsers.length} Users
                    </span>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add User
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin h-10 w-10 text-indigo-600 border-b-2 border-indigo-600 rounded-full" />
                </div>
            ) : (
                <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Global Role</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Clubs</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold uppercase">
                                                {user.email.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-bold rounded-full border ${user.is_superuser
                                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                                            : user.role === 'club_admin'
                                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                            {user.is_superuser ? 'SUPERUSER' : user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {user.is_superuser ? (
                                                <span className="text-xs text-purple-600 font-bold italic flex items-center gap-1">
                                                    <Shield className="w-3 h-3" />
                                                    Global Access
                                                </span>
                                            ) : user.clubs.length > 0 ? (
                                                user.clubs.map(c => {
                                                    const clubName = clubs.find(cl => cl.club_id === c.club_id)?.name || 'Unknown Club'
                                                    return (
                                                        <span key={c.club_id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[11px] font-bold">
                                                            {clubName}
                                                        </span>
                                                    )
                                                })
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">No clubs assigned</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingUser(user)}
                                                className="text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Edit Permissions"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.user_id, user.email)}
                                                className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-all"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Edit Permissions</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{editingUser.email}</p>
                            </div>
                            <button
                                onClick={() => setEditingUser(null)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-full transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-indigo-600" />
                                    Global Permission Level
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setEditingUser({ ...editingUser, role: 'club_admin', is_superuser: false })}
                                        className={`p-4 border-2 rounded-xl text-left transition-all ${!editingUser.is_superuser && editingUser.role === 'club_admin'
                                            ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <p className="font-bold text-gray-900">Club Manager</p>
                                        <p className="text-[10px] text-gray-500 mt-1">Full access to assigned clubs only.</p>
                                    </button>
                                    <button
                                        onClick={() => setEditingUser({ ...editingUser, role: 'superuser', is_superuser: true })}
                                        className={`p-4 border-2 rounded-xl text-left transition-all ${editingUser.is_superuser
                                            ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-100'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <p className="font-bold text-gray-900">Superuser</p>
                                        <p className="text-[10px] text-gray-500 mt-1">Full global administrative access.</p>
                                    </button>
                                </div>
                            </div>

                            {/* Club Assignment (Only for non-superusers) */}
                            {!editingUser.is_superuser && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-indigo-600" />
                                        Assigned Clubs
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {clubs.map(club => {
                                            const isAssigned = editingUser.clubs.some(c => c.club_id === club.club_id)
                                            return (
                                                <label key={club.club_id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isAssigned ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:bg-gray-50'
                                                    }`}>
                                                    <span className="text-sm font-bold text-gray-800">{club.name}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isAssigned}
                                                        onChange={(e) => {
                                                            const newClubs = e.target.checked
                                                                ? [...editingUser.clubs, { user_id: editingUser.user_id, club_id: club.club_id, role: 'club_admin' }]
                                                                : editingUser.clubs.filter(c => c.club_id !== club.club_id)
                                                            setEditingUser({ ...editingUser, clubs: newClubs })
                                                        }}
                                                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    />
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {editingUser.is_superuser && (
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex gap-3">
                                    <Shield className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-purple-800 leading-relaxed">
                                        Superusers bypass all club-level security checks and can access any club in the system. Club-specific assignments are disabled.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="flex-1 py-2.5 px-4 border border-gray-300 bg-white text-sm font-bold rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSaveAssignment(
                                    editingUser.user_id,
                                    editingUser.is_superuser ? [] : editingUser.clubs.map(c => c.club_id),
                                    editingUser.is_superuser ? 'superuser' : 'club_admin'
                                )}
                                disabled={isSaving}
                                className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-indigo-200 shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isSaving ? (
                                    <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Save Permissions
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Create New User</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Setup a new staff account with immediate access.</p>
                            </div>
                            <button
                                onClick={() => setIsInviteModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-full transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label htmlFor="invite-email" className="block text-sm font-bold text-gray-900 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        id="invite-email"
                                        type="email"
                                        required
                                        placeholder="colleague@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>

                                {!sendWelcomeEmail && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label htmlFor="invite-password" className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-indigo-500" />
                                            Manual Password
                                        </label>
                                        <input
                                            id="invite-password"
                                            type="text"
                                            required={!sendWelcomeEmail}
                                            value={invitePassword}
                                            onChange={(e) => setInvitePassword(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono bg-indigo-50/30"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">Admin-defined password. No email will be sent.</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">
                                    Initial Club Assignments
                                </label>
                                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-gray-50/30">
                                    {clubs.map(club => (
                                        <label key={club.club_id} className="flex items-center gap-2 p-2 hover:bg-white hover:shadow-sm rounded-lg cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                checked={selectedClubIds.includes(club.club_id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedClubIds(prev => [...prev, club.club_id])
                                                    } else {
                                                        setSelectedClubIds(prev => prev.filter(id => id !== club.club_id))
                                                    }
                                                }}
                                                className="rounded-md text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-gray-300"
                                            />
                                            <span className="text-sm font-medium text-gray-700">{club.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 py-3 border-t border-b border-gray-50">
                                <input
                                    id="send-email"
                                    type="checkbox"
                                    checked={sendWelcomeEmail}
                                    onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                                    className="rounded-md text-indigo-600 focus:ring-indigo-500 h-5 w-5 border-gray-300"
                                />
                                <div className="flex flex-col">
                                    <label htmlFor="send-email" className="text-sm font-bold text-gray-900 cursor-pointer">
                                        Invitation Mode
                                    </label>
                                    <p className="text-xs text-gray-500">Sends a secure email; User sets their own password.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsInviteModalOpen(false)}
                                    className="flex-1 py-3 px-4 border border-gray-200 bg-white text-sm font-bold rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isInviting || !inviteEmail || (!sendWelcomeEmail && !invitePassword)}
                                    className={`flex-1 py-3 px-4 text-white text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2 ${sendWelcomeEmail ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-slate-800 hover:bg-slate-900 shadow-slate-100'
                                        }`}
                                >
                                    {isInviting ? (
                                        <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
                                    ) : (
                                        <>
                                            {sendWelcomeEmail ? <Mail className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                            {sendWelcomeEmail ? 'Send Invitation' : 'Create Account'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
