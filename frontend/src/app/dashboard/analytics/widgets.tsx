import React from 'react';

// --- Types ---

export interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon?: React.ReactNode;
    color?: 'indigo' | 'green' | 'blue' | 'yellow' | 'red';
}

export interface ProgressBarChartProps {
    title: string;
    data: { label: string; value: number; color?: string }[];
    total?: number; // Optional override
}

export interface LeaderboardProps {
    title: string;
    data: { name: string; score: number | string; subtext?: string }[];
    metricLabel?: string;
}

export interface SkillLevelRangesProps {
    title: string;
    data: { label: string; value: number }[];
}


// --- Components ---

export function StatCard({ label, value, subValue, icon, color = 'indigo' }: StatCardProps) {
    const colorClasses = {
        indigo: 'bg-indigo-50 text-indigo-700',
        green: 'bg-green-50 text-green-700',
        blue: 'bg-blue-50 text-blue-700',
        yellow: 'bg-yellow-50 text-yellow-700',
        red: 'bg-red-50 text-red-700',
    };

    return (
        <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 p-5">
            <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className={`rounded-md p-3 ${colorClasses[color]}`}>
                        {icon || (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        )}
                    </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                    <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
                        <dd>
                            <div className="text-lg font-medium text-gray-900">{value}</div>
                            {subValue && <div className="text-xs text-gray-400 mt-0.5">{subValue}</div>}
                        </dd>
                    </dl>
                </div>
            </div>
        </div>
    );
}

export function ProgressBarChart({ title, data, total }: ProgressBarChartProps) {
    const maxVal = total || Math.max(...data.map(d => d.value), 1); // Avoid div by zero

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{title}</h3>
            <div className="space-y-4">
                {data.map((item, idx) => {
                    const pct = total ? (item.value / total) * 100 : (item.value / maxVal) * 100; // if total provided, use it as denom, else simple relative
                    const widthStart = pct > 0 ? `${pct}%` : '1px'; // ensure visible

                    return (
                        <div key={idx}>
                            <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-1">
                                <span>{item.label}</span>
                                <span>{item.value}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className={`h-2.5 rounded-full ${item.color || 'bg-indigo-500'}`}
                                    style={{ width: widthStart }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function SkillLevelRanges({ title, data }: SkillLevelRangesProps) {
    const categories = [
        { name: 'Beginner', ranges: ['2.0-2.5', '2.5-3.0'], color: 'bg-blue-400' },
        { name: 'Intermediate', ranges: ['3.0-3.5', '3.5-4.0'], color: 'bg-emerald-400' },
        { name: 'Advanced', ranges: ['4.0-4.5', '4.5-5.0'], color: 'bg-amber-400' },
        { name: 'Pro', ranges: ['5.0-5.5', '> 5.5'], color: 'bg-indigo-400' },
    ];

    const maxVal = Math.max(...data.map((d: { value: number }) => d.value), 1);

    // Map data for easy access by range label
    const dataMap = Object.fromEntries(data.map(d => [d.label, d.value]));

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">{title}</h3>
            <div className="space-y-6">
                {categories.map((cat, catIdx) => (
                    <div key={catIdx} className="flex gap-4 group">
                        {/* Category Label & Bracket */}
                        <div className="w-28 shrink-0 flex items-stretch">
                            <div className="flex flex-col justify-center text-right pr-3 flex-1 overflow-hidden">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">
                                    {cat.name}
                                </span>
                            </div>
                            {/* The Bracket Line */}
                            <div className={`w-1 shrink-0 rounded-full ${cat.color} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                        </div>

                        {/* Ranges in this category */}
                        <div className="flex-1 space-y-3">
                            {cat.ranges.map((rangeLabel, rangeIdx) => {
                                const value = dataMap[rangeLabel] || 0;
                                const widthPct = (value / maxVal) * 100;

                                return (
                                    <div key={rangeIdx} className="flex items-center">
                                        <div className="w-16 text-xs font-semibold text-gray-500 shrink-0">
                                            {rangeLabel}
                                        </div>
                                        <div className="flex-1 h-7 bg-gray-50 rounded-sm relative overflow-hidden flex items-center pr-12 transition-all group-hover:bg-gray-100">
                                            <div
                                                className={`h-full transition-all duration-700 rounded-r-sm ${cat.color}`}
                                                style={{ width: `${widthPct}%` }}
                                            ></div>
                                            <div className="ml-3 text-sm font-bold text-gray-700 z-10">
                                                {value}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function LeaderboardTable({ title, data, metricLabel }: LeaderboardProps) {
    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
            </div>
            <ul className="divide-y divide-gray-200">
                {data.length === 0 ? (
                    <li className="px-6 py-4 text-sm text-gray-500 text-center">No data available</li>
                ) : (
                    data.map((item, idx) => (
                        <li key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center">
                                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${idx < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                    {item.subtext && <p className="text-xs text-gray-500">{item.subtext}</p>}
                                </div>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 items-end flex flex-col">
                                <span>{item.score}</span>
                                {metricLabel && <span className="text-xs text-gray-400 font-normal">{metricLabel}</span>}
                            </div>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
