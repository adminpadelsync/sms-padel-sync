'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Info, Trophy, Target, Calendar, User, MessageSquare, Edit2, Check, X, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { QUESTIONS, calculateRating } from '@/utils/assessment-constants';

interface Breakdown {
    percentage: number;
    rawRating: number;
    ceiling: number;
    wasCapped: boolean;
    rating: number;
}

interface AssessmentResult {
    id: string;
    player_name: string;
    rating: number;
    responses: Record<string, number>;
    breakdown: Breakdown;
    created_at: string;
}

export default function AssessmentViewerPage() {
    const [results, setResults] = useState<AssessmentResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedResult, setSelectedResult] = useState<AssessmentResult | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Simulator state
    const [tempResponses, setTempResponses] = useState<Record<string, number>>({});
    const [tempBreakdown, setTempBreakdown] = useState<Breakdown | null>(null);

    useEffect(() => {
        if (selectedResult) {
            setTempResponses(selectedResult.responses);
            setTempBreakdown(selectedResult.breakdown);
        }
    }, [selectedResult]);

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/assessment/results');
            const data = await res.json();
            setResults(data.results || []);
        } catch (error) {
            console.error('Failed to fetch assessment results:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateName = async (id: string) => {
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/assessment/results/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_name: editName }),
            });
            if (res.ok) {
                setResults(results.map(r => r.id === id ? { ...r, player_name: editName } : r));
                setEditingId(null);
            }
        } catch (error) {
            console.error('Failed to update name:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAdjustAnswer = (questionId: string, delta: number) => {
        const q = QUESTIONS.find(q => q.id === questionId);
        if (!q) return;

        const currentValue = tempResponses[questionId] || 0;
        const newValue = Math.max(0, Math.min(4, currentValue + delta));

        const newResponses = { ...tempResponses, [questionId]: newValue };
        setTempResponses(newResponses);
        setTempBreakdown(calculateRating(newResponses));
    };

    const handleResetSimulator = () => {
        if (selectedResult) {
            setTempResponses(selectedResult.responses);
            setTempBreakdown(selectedResult.breakdown);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <a href="/dashboard/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </a>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Level Assessment Results</h1>
                    <p className="text-sm text-gray-500">Browse all self-assessments submitted via the public tool.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : results.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
                    No assessment results found yet.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Player</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Final Rating</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Skill %</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Submission Date</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {results.map((result) => (
                                    <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            {editingId === result.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="px-2 py-1 text-sm border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none w-40"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateName(result.id)}
                                                        disabled={isUpdating}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group">
                                                    <div className="font-semibold text-gray-900">{result.player_name || 'Anonymous'}</div>
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(result.id);
                                                            setEditName(result.player_name || '');
                                                        }}
                                                        className="p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="text-xs text-gray-500">{result.id.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                                                {result.rating.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-medium text-gray-900">{result.breakdown?.percentage}%</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600 flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                {formatDate(result.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedResult(result)}
                                                className="text-indigo-600 hover:text-indigo-900 text-sm font-semibold"
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Assessment Details Modal */}
            {selectedResult && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
                        <div className="p-6 border-b flex justify-between items-center group">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-indigo-600" />
                                Assessment Details
                                {JSON.stringify(tempResponses) !== JSON.stringify(selectedResult.responses) && (
                                    <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                        Simulated
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-4">
                                {JSON.stringify(tempResponses) !== JSON.stringify(selectedResult.responses) && (
                                    <button
                                        onClick={handleResetSimulator}
                                        className="text-xs flex items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Reset
                                    </button>
                                )}
                                <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Player Name</label>
                                    <div className="text-lg font-semibold flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-500" />
                                        {selectedResult.player_name || 'Anonymous'}
                                    </div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Date</label>
                                    <div className="text-sm text-gray-600">{formatDate(selectedResult.created_at)}</div>
                                </div>
                            </div>

                            <div className={`rounded-2xl p-6 grid grid-cols-3 gap-6 text-center border transition-all duration-300 ${JSON.stringify(tempResponses) !== JSON.stringify(selectedResult.responses)
                                ? 'bg-amber-50 border-amber-100 shadow-inner'
                                : 'bg-indigo-50 border-indigo-100'
                                }`}>
                                <div>
                                    <div className={`text-3xl font-black transition-colors ${tempBreakdown?.rating !== selectedResult.rating ? 'text-amber-600' : 'text-indigo-600'
                                        }`}>
                                        {tempBreakdown?.rating.toFixed(2)}
                                    </div>
                                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Rating</div>
                                </div>
                                <div>
                                    <div className={`text-3xl font-black transition-colors ${tempBreakdown?.percentage !== selectedResult.breakdown?.percentage ? 'text-amber-600' : 'text-indigo-600'
                                        }`}>
                                        {tempBreakdown?.percentage}%
                                    </div>
                                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Skill Score</div>
                                </div>
                                <div>
                                    <div className={`text-3xl font-black transition-colors ${tempBreakdown?.ceiling !== selectedResult.breakdown?.ceiling ? 'text-amber-600' : 'text-indigo-600'
                                        }`}>
                                        {tempBreakdown?.ceiling.toFixed(2)}
                                    </div>
                                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Exp. Ceiling</div>
                                </div>
                            </div>

                            {tempBreakdown?.wasCapped && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 animate-in fade-in duration-300">
                                    <Info className="w-5 h-5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <span className="font-bold">Capped:</span> Raw rating was {tempBreakdown.rawRating.toFixed(2)}, but limited competition experience reduced it to {tempBreakdown.ceiling.toFixed(2)}.
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                                    Detailed Responses
                                </h4>
                                <div className="space-y-4">
                                    {QUESTIONS.map((q, idx) => {
                                        const answerValue = tempResponses[q.id];
                                        const selectedOption = q.options.find(opt => opt.value === answerValue);
                                        const originalValue = selectedResult.responses[q.id];
                                        const contribution = (answerValue || 0) * q.weight;

                                        return (
                                            <div key={q.id} className={`rounded-xl p-4 border transition-colors ${answerValue !== originalValue
                                                ? 'bg-amber-50 border-amber-200 shadow-sm'
                                                : 'bg-gray-50 border-gray-100'
                                                } relative group`}>
                                                <div className={`absolute top-4 right-4 text-[10px] font-black px-2 py-0.5 rounded-full ${answerValue !== originalValue
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                    +{contribution.toFixed(1)} pts
                                                </div>
                                                <div className="text-xs font-bold text-gray-400 uppercase mb-3 flex justify-between items-center">
                                                    <span>Question {idx + 1}: {q.question}</span>
                                                </div>

                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        Answer: {answerValue}: {selectedOption?.text || 'N/A'}
                                                    </div>

                                                    {/* Rocker Switch */}
                                                    <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden shrink-0">
                                                        <button
                                                            onClick={() => handleAdjustAnswer(q.id, 1)}
                                                            disabled={answerValue >= 4}
                                                            className="p-1 hover:bg-white text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition-colors border-b border-gray-100"
                                                        >
                                                            <ChevronUp className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAdjustAnswer(q.id, -1)}
                                                            disabled={answerValue <= 0}
                                                            className="p-1 hover:bg-white text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                                                        >
                                                            <ChevronDown className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-indigo-600" />
                                    Raw Data (JSON)
                                </h4>
                                <pre className="bg-gray-900 text-indigo-300 p-4 rounded-xl text-xs overflow-x-auto">
                                    {JSON.stringify(tempResponses, null, 2)}
                                </pre>
                            </div>
                        </div>

                        <div className="p-6 border-t flex justify-end">
                            <button
                                onClick={() => setSelectedResult(null)}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
