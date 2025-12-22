'use client';

import React, { useState } from 'react';
import { Trophy, ChevronLeft, Target, Award, Info, AlertTriangle } from 'lucide-react';

import { QUESTIONS } from '@/utils/assessment-constants';

const calculateRating = (answers: Record<string, number>) => {
    let weightedTotal = 0;
    let maxWeightedTotal = 0;

    QUESTIONS.forEach((q) => {
        const answer = answers[q.id];
        if (answer !== undefined) {
            weightedTotal += answer * q.weight;
        }
        maxWeightedTotal += 4 * q.weight;
    });

    const percentage = weightedTotal / maxWeightedTotal;

    let rawRating;
    if (percentage < 0.5) {
        rawRating = 2.0 + (percentage / 0.5) * 1.5;
    } else if (percentage < 0.75) {
        rawRating = 3.5 + ((percentage - 0.5) / 0.25) * 0.75;
    } else {
        rawRating = 4.25 + ((percentage - 0.75) / 0.25) * 1.75;
    }

    const competitionAnswer = answers['competition'];
    const competitionQuestion = QUESTIONS.find(q => q.id === 'competition');
    // @ts-ignore
    const ceiling = competitionQuestion?.options[competitionAnswer]?.ceiling || 6.0;

    const cappedRating = Math.min(rawRating, ceiling);
    const roundedRating = Math.round(cappedRating * 4) / 4;
    const finalRating = Math.min(6.0, Math.max(2.0, roundedRating));

    return {
        rating: finalRating,
        rawRating: rawRating,
        ceiling: ceiling,
        wasCapped: rawRating > ceiling,
        percentage: Math.round(percentage * 100),
    };
};

const getRatingDescription = (rating: number) => {
    if (rating < 2.5) return { level: 'Beginner', desc: "You're just getting started with padel. Focus on fundamentals: grip, basic strokes, and understanding the rules." };
    if (rating < 3.0) return { level: 'Advanced Beginner', desc: 'You understand the basics and can sustain rallies. Work on consistency and start learning the walls.' };
    if (rating < 3.5) return { level: 'Intermediate', desc: "You're comfortable in social games with developing wall play. Keep working on the bandeja and court positioning." };
    if (rating < 4.0) return { level: 'Solid Intermediate', desc: 'You have a well-rounded game and compete well in club play. Focus on point construction and overhead shots.' };
    if (rating < 4.5) return { level: 'Advanced Intermediate', desc: "You're a strong club player who can handle most situations. Refine your tactical game and specialty shots." };
    if (rating < 5.0) return { level: 'Advanced', desc: "You're among the better players at most clubs. You have weapons and few weaknesses. Tournament-ready." };
    if (rating < 5.5) return { level: 'Strong Advanced', desc: 'You compete and place in tournaments. Your game is well-rounded with tactical depth.' };
    return { level: 'Expert', desc: "You're at or near the top level of amateur play. You should be competing in high-level tournaments." };
};

const getMatchRange = (rating: number) => {
    const low = Math.max(2.0, rating - 0.5);
    const high = Math.min(6.0, rating + 0.5);
    return `${low.toFixed(2)} - ${high.toFixed(2)}`;
};

export function PadelAssessment() {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [showResult, setShowResult] = useState(false);
    const [rating, setRating] = useState<number | null>(null);
    const [breakdown, setBreakdown] = useState<any>(null);
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnswer = (value: number) => {
        const newAnswers = { ...answers, [QUESTIONS[currentQuestion].id]: value };
        setAnswers(newAnswers);

        if (currentQuestion < QUESTIONS.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            const result = calculateRating(newAnswers);
            setRating(result.rating);
            setBreakdown(result);
            setShowResult(true);
        }
    };

    const handleBack = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const handleRestart = () => {
        setCurrentQuestion(0);
        setAnswers({});
        setShowResult(false);
        setRating(null);
        setBreakdown(null);
        setIsSaved(false);
    };

    const handleSubmit = async () => {
        if (!rating || !breakdown) return;

        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/assessment/results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player_name: name || 'Anonymous',
                    responses: answers,
                    rating: rating,
                    breakdown: breakdown,
                }),
            });

            if (response.ok) {
                setIsSaved(true);
            } else {
                const data = await response.json().catch(() => ({}));
                setError(data.detail || 'Failed to save results. Please try again.');
            }
        } catch (error) {
            console.error('Failed to save assessment:', error);
            setError('Network error. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const progress = ((currentQuestion) / QUESTIONS.length) * 100;

    if (showResult && rating !== null) {
        const { level, desc } = getRatingDescription(rating);
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className="bg-card border rounded-3xl p-8 shadow-xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6 text-primary">
                            <Trophy className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2">Your Padel Rating</h2>
                        <p className="text-muted-foreground">Based on your self-assessment</p>
                    </div>

                    <div className="bg-primary/5 rounded-3xl p-8 mb-8 text-center border border-primary/10">
                        <div className="text-7xl font-black text-primary mb-2">{rating.toFixed(2)}</div>
                        <div className="text-2xl font-bold">{level}</div>
                    </div>

                    <p className="text-muted-foreground text-center mb-8 leading-relaxed max-w-md mx-auto">{desc}</p>

                    <div className="grid sm:grid-cols-2 gap-4 mb-8">
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400">
                                <Target className="w-5 h-5" />
                                <span className="text-sm font-bold uppercase tracking-wider">Match Range</span>
                            </div>
                            <div className="text-2xl font-bold mb-1">{getMatchRange(rating)}</div>
                            <p className="text-amber-600/80 dark:text-amber-400/60 text-xs">Players in this range will give you competitive games</p>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400">
                                <Award className="w-5 h-5" />
                                <span className="text-sm font-bold uppercase tracking-wider">Skill Score</span>
                            </div>
                            <div className="text-2xl font-bold mb-1">{breakdown?.percentage}%</div>
                            <p className="text-blue-600/80 dark:text-blue-400/60 text-xs">Overall consistency and technical proficiency</p>
                        </div>
                    </div>

                    {breakdown?.wasCapped && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 mb-8 flex gap-4">
                            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                            <div>
                                <p className="text-amber-800 dark:text-amber-300 font-semibold mb-1">Competition Experience Cap</p>
                                <p className="text-amber-700/80 dark:text-amber-400/80 text-sm">
                                    Your skill score suggests {breakdown.rawRating.toFixed(2)}, but limited competition experience caps you at {breakdown.ceiling.toFixed(2)}.
                                    Play in tournaments to unlock your full rating!
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6 pt-6 border-t">
                        {!isSaved ? (
                            <div className="space-y-4">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Info className="w-4 h-4 text-primary" />
                                    Save your result
                                </h3>
                                {error && (
                                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl">
                                        {error}
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="text"
                                        placeholder="Enter your name (optional)"
                                        className="flex-1 px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="bg-primary text-primary-foreground font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save Result'}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">This helps us validate our self-assessment algorithm.</p>
                            </div>
                        ) : (
                            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-2xl p-4 text-center">
                                <p className="text-green-700 dark:text-green-400 font-bold">✓ Assessment saved successfully. Thank you!</p>
                            </div>
                        )}

                        <button
                            onClick={handleRestart}
                            className="w-full bg-secondary text-secondary-foreground font-semibold py-4 px-6 rounded-2xl hover:bg-secondary/80 transition-all border shadow-sm"
                        >
                            Retake Assessment
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = QUESTIONS[currentQuestion];

    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            <div className="bg-card border rounded-3xl p-8 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-primary uppercase italic">Padel Sync</h1>
                        <p className="text-muted-foreground text-sm font-medium">Skill Assessment</p>
                    </div>
                    <div className="text-right">
                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Progress</span>
                        <div className="text-primary font-black text-xl">{currentQuestion + 1} / {QUESTIONS.length}</div>
                    </div>
                </div>

                <div className="w-full bg-secondary rounded-full h-3 mb-10 overflow-hidden">
                    <div
                        className="bg-primary h-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="mb-8">
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4 border border-primary/20">
                        {currentQ.category}
                    </div>
                    <h2 className="text-2xl font-bold leading-tight">
                        {currentQ.question}
                    </h2>
                </div>

                <div className="space-y-3 mb-10">
                    {currentQ.options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleAnswer(option.value)}
                            className="group w-full text-left p-5 rounded-2xl transition-all border hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] relative overflow-hidden"
                        >
                            <div className="flex items-center justify-between gap-4 relative z-10">
                                <span className="font-semibold group-hover:text-primary transition-colors">{option.text}</span>
                                <div className="w-6 h-6 rounded-full border-2 border-muted group-hover:border-primary transition-colors flex items-center justify-center">
                                    <div className="w-3 h-3 rounded-full bg-primary scale-0 group-active:scale-100 transition-transform" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {currentQuestion > 0 && (
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold uppercase text-xs tracking-widest"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Go Back
                    </button>
                )}
            </div>
        </div>
    );
}
