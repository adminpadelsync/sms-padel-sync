'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface PlayerRanking {
    player_id: string;
    name: string;
    elo_rating: number;
    elo_confidence: number;
    adjusted_skill_level: number;
    gender: string;
}

export function RankingsClient({ initialClubId }: { initialClubId: string | null }) {
    const searchParams = useSearchParams();
    const clubIdFromUrl = searchParams.get('clubId');
    const clubId = clubIdFromUrl || initialClubId;

    const [rankings, setRankings] = useState<PlayerRanking[]>([]);
    const [loading, setLoading] = useState(true);
    const [genderFilter, setGenderFilter] = useState('all');

    const fetchRankings = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/clubs/${clubId}/rankings`);
            const data = await response.json();
            setRankings(data.rankings || []);
        } catch (error) {
            console.error('Error fetching rankings:', error);
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        if (clubId) {
            fetchRankings();
        } else {
            setLoading(false);
        }
    }, [clubId, fetchRankings]);

    const filteredRankings = rankings.filter(p =>
        genderFilter === 'all' || p.gender === genderFilter
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!clubId) {
        return (
            <div className="p-12 text-center text-gray-500">
                No club context found. Please select a club or ensure you are logged in correctly.
            </div>
        )
    }

    const top3 = filteredRankings.slice(0, 3);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Community Rankings</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Top players ranked by Sync Rating (Elo-based). Higher rating means better performance.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Filter:</label>
                    <select
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value)}
                        className="block w-[140px] pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option value="all">All Genders</option>
                        <option value="male">Men</option>
                        <option value="female">Women</option>
                    </select>
                </div>
            </div>

            {/* Podium Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {top3.map((player, index) => (
                    <div
                        key={player.player_id}
                        className={`relative overflow-hidden rounded-xl border-2 p-6 ${index === 0 ? 'border-yellow-400 bg-yellow-50/50' :
                            index === 1 ? 'border-gray-300 bg-gray-50/50' :
                                'border-amber-600/30 bg-amber-50/30'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                {index === 0 ? '🏆 Rank #1' : index === 1 ? '🥈 Rank #2' : '🥉 Rank #3'}
                            </span>
                            {index === 0 ? (
                                <span className="text-2xl">🥇</span>
                            ) : index === 1 ? (
                                <span className="text-2xl">🥈</span>
                            ) : (
                                <span className="text-2xl">🥉</span>
                            )}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{player.name}</div>
                        <div className="flex items-center gap-3 mt-4">
                            <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-lg font-mono font-bold text-indigo-700">
                                {player.adjusted_skill_level?.toFixed(2) || '0.00'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                                Sync Rating
                            </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                            Based on {player.elo_confidence} competitive matches
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Leaderboard Table */}
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900">Leaderboard</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300 text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-sm font-semibold text-gray-900 sm:pl-6">Rank</th>
                                <th scope="col" className="px-3 py-3.5 text-sm font-semibold text-gray-900">Player</th>
                                <th scope="col" className="px-3 py-3.5 text-sm font-semibold text-gray-900">Gender</th>
                                <th scope="col" className="px-3 py-3.5 text-sm font-semibold text-gray-900">Matches</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Sync Rating</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredRankings.map((player, index) => (
                                <TableRow key={player.player_id} index={index} player={player} />
                            ))}
                            {filteredRankings.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-500 sm:px-6">
                                        No rankings recorded for this club yet. Report match results via SMS to see them here!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function TableRow({ index, player }: { index: number; player: PlayerRanking }) {
    return (
        <tr className="hover:bg-gray-50 transition-colors">
            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-gray-500 sm:pl-6">
                #{index + 1}
            </td>
            <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                {player.name}
            </td>
            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                {player.gender}
            </td>
            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {player.elo_confidence}
            </td>
            <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-mono font-bold text-indigo-600 sm:pr-6">
                {player.adjusted_skill_level?.toFixed(2) || '0.00'}
            </td>
        </tr>
    );
}
