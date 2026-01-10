'use client';

import React, { useEffect, useState } from 'react';
import { StatCard, SkillLevelRanges, LeaderboardTable } from './widgets';
import { authFetch } from '@/utils/auth-fetch';

interface AnalyticsDashboardProps {
    clubId: string;
}

export function AnalyticsDashboard({ clubId }: AnalyticsDashboardProps) {
    const [health, setHealth] = useState<any>(null);
    const [activity, setActivity] = useState<any>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const [healthRes, activityRes, feedbackRes] = await Promise.all([
                    authFetch(`/api/insights/health?club_id=${clubId}`),
                    authFetch(`/api/insights/activity?club_id=${clubId}`),
                    authFetch(`/api/insights/feedback?club_id=${clubId}`)
                ]);

                if (!healthRes.ok) throw new Error(`Health API Error: ${healthRes.statusText}`);
                if (!activityRes.ok) throw new Error(`Activity API Error: ${activityRes.statusText}`);
                if (!feedbackRes.ok) throw new Error(`Feedback API Error: ${feedbackRes.statusText}`);

                setHealth(await healthRes.json());
                setActivity(await activityRes.json());
                setFeedback(await feedbackRes.json());

            } catch (error: any) {
                console.error("Failed to fetch analytics", error);
                setError(error.message || "Unknown error occurred");
            } finally {
                setLoading(false);
            }
        }

        if (clubId) {
            fetchData();
        }
    }, [clubId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 font-medium mb-2">Unable to load analytics data</div>
                <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded inline-block">
                    Error Details: {error}
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="block mx-auto mt-4 text-sm text-indigo-600 hover:text-indigo-800"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!health || !activity || !feedback) {
        return <div className="p-4 text-center text-gray-500">No analytics data available.</div>;
    }

    // Prepare Skill Distribution Data - backend returns range labels
    const skillData = Object.entries(health.skill_distribution || {}).map(([range, count]) => ({
        label: range,
        value: Number(count)
    }));

    // Prepare Top Players Data
    const topPlayersData = (feedback.top_players || []).map((p: any) => ({
        name: p.name,
        score: p.avg_rating,
        subtext: `${p.count} ratings`
    }));

    return (
        <div className="space-y-6">
            {/* Header / Intro */}
            <div>
                <h2 className="text-xl font-semibold text-gray-900">Club Health & Insights</h2>
                <p className="mt-1 text-sm text-gray-500">Metrics calculated from real-time player data and activity.</p>
            </div>

            {/* Row 1: KPI Cards (Setup Health) */}
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Setup Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Verified Players"
                    value={`${health.verified_pct}%`}
                    subValue={`${Math.round(health.total_players * (health.verified_pct / 100))} / ${health.total_players} players`}
                    color="blue"
                    icon={
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatCard
                    label="Availability Set"
                    value={`${health.availability_pct}%`}
                    subValue="Can receive matches"
                    color="green"
                    icon={
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatCard
                    label="Invite Acceptance"
                    value={`${activity.invite_acceptance_rate}%`}
                    subValue={`${activity.invites_accepted} accepted / ${activity.invites_sent} sent`}
                    color="indigo"
                    icon={
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    }
                />
                <StatCard
                    label="Match Conversion"
                    value={`${activity.match_conversion_rate}%`}
                    subValue={`${activity.matches_confirmed} confirmed / ${activity.matches_requested} req`}
                    color="yellow"
                    icon={
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
            </div>

            {/* Row 2: Charts (Activity & Distribution) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SkillLevelRanges
                    title="Skill Level Distribution"
                    data={skillData}
                />

                <LeaderboardTable
                    title="Top Rated Players (Feedback)"
                    data={topPlayersData}
                    metricLabel="Avg Rating"
                />
            </div>
        </div>
    );
}
