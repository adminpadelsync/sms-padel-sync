'use client';

import React, { useState } from 'react';
import { Trophy, ChevronLeft, Target, Award, Info, AlertTriangle } from 'lucide-react';

const QUESTIONS = [
    {
        id: 'experience',
        category: 'Background',
        weight: 1.0,
        question: 'How long have you been playing padel regularly?',
        options: [
            { text: 'Just started (less than 3 months)', value: 0 },
            { text: '3-12 months', value: 1 },
            { text: '1-2 years', value: 2 },
            { text: '2-4 years', value: 3 },
            { text: '4+ years', value: 4 },
        ],
    },
    {
        id: 'racquet_background',
        category: 'Background',
        weight: 1.0,
        question: "What's your racquet sport background?",
        options: [
            { text: 'No prior racquet sports', value: 0 },
            { text: 'Casual tennis/pickleball/squash', value: 1 },
            { text: 'Played tennis/squash competitively (high school, club league)', value: 2 },
            { text: 'Strong tennis/squash player (4.0+ NTRP or equivalent)', value: 3 },
            { text: 'Collegiate or semi-pro level in another racquet sport', value: 4 },
        ],
    },
    {
        id: 'rally_consistency',
        category: 'Consistency',
        weight: 1.0,
        question: 'In a typical rally, how consistent are your groundstrokes?',
        options: [
            { text: 'I often miss or hit the ball out of play', value: 0 },
            { text: 'I can keep the ball in play at slow/medium pace', value: 1 },
            { text: "I'm consistent at medium pace with occasional errors", value: 2 },
            { text: 'I rarely make unforced errors at medium-fast pace', value: 3 },
            { text: 'I can sustain long rallies at high pace with control', value: 4 },
        ],
    },
    {
        id: 'serve',
        category: 'Technical',
        weight: 0.8,
        question: 'How would you describe your serve?',
        options: [
            { text: 'I just try to get it in', value: 0 },
            { text: 'Consistent but no real placement or spin', value: 1 },
            { text: 'I can place my serve and use some slice', value: 2 },
            { text: 'I vary spin, pace, and placement effectively', value: 3 },
            { text: 'My serve is a weapon - I win easy points with it', value: 4 },
        ],
    },
    {
        id: 'volley',
        category: 'Net Play',
        weight: 1.0,
        question: 'How comfortable are you at the net?',
        options: [
            { text: 'I avoid the net or struggle with volleys', value: 0 },
            { text: 'I can volley but often pop it up or lose control', value: 1 },
            { text: "I'm solid on routine volleys, working on placement", value: 2 },
            { text: 'I control the net well and can place volleys deep', value: 3 },
            { text: 'I dominate at the net - volleys, reflexes, and putaways', value: 4 },
        ],
    },
    {
        id: 'bandeja_vibora',
        category: 'Technical',
        weight: 0.8,
        question: 'How is your bandeja and/or vibora (overhead slice shots)?',
        options: [
            { text: "I don't know these shots or can't execute them", value: 0 },
            { text: "I'm learning but inconsistent", value: 1 },
            { text: 'I can execute a bandeja to stay at the net', value: 2 },
            { text: 'I hit bandejas with direction and can attempt viboras', value: 3 },
            { text: 'I use bandeja/vibora to control points and finish with winners', value: 4 },
        ],
    },
    {
        id: 'back_glass',
        category: 'Wall Play',
        weight: 1.2,
        question: 'How do you handle balls off the back glass?',
        options: [
            { text: 'I struggle to read the bounce and often miss', value: 0 },
            { text: 'I can return slow balls off the glass', value: 1 },
            { text: "I'm comfortable with most back glass shots", value: 2 },
            { text: 'I handle fast balls off the glass and can attack', value: 3 },
            { text: 'The back glass is my strength - I turn defense into offense', value: 4 },
        ],
    },
    {
        id: 'side_double_glass',
        category: 'Wall Play',
        weight: 1.2,
        question: 'How about side glass and double-wall (esquina) shots?',
        options: [
            { text: 'I usually let these go or miss them', value: 0 },
            { text: 'I can return simple side glass balls', value: 1 },
            { text: 'I handle side glass and attempt double-wall returns', value: 2 },
            { text: "I'm confident with most wall combinations", value: 3 },
            { text: 'I read all wall bounces well and use them offensively', value: 4 },
        ],
    },
    {
        id: 'lob',
        category: 'Technical',
        weight: 0.8,
        question: 'How effective are your lobs?',
        options: [
            { text: "I rarely attempt lobs or they're easy to smash", value: 0 },
            { text: 'I lob to buy time but lack control', value: 1 },
            { text: 'I can hit defensive lobs with decent depth', value: 2 },
            { text: 'I use lobs tactically to move opponents and take the net', value: 3 },
            { text: 'My lobs are a weapon - I hit offensive lobs and create opportunities', value: 4 },
        ],
    },
    {
        id: 'positioning',
        category: 'Tactics',
        weight: 1.1,
        question: 'How well do you and your partner move together on the court?',
        options: [
            { text: "We often leave gaps or get in each other's way", value: 0 },
            { text: "We're learning to move as a team", value: 1 },
            { text: 'We maintain decent positioning most of the time', value: 2 },
            { text: 'We move well as a unit and cover the court efficiently', value: 3 },
            { text: 'We switch, rotate, and communicate seamlessly', value: 4 },
        ],
    },
    {
        id: 'point_construction',
        category: 'Tactics',
        weight: 1.1,
        question: 'How do you approach building points?',
        options: [
            { text: 'I just try to keep the ball in play', value: 0 },
            { text: 'I hit where I can and hope for errors', value: 1 },
            { text: 'I try to work the point but sometimes go for too much', value: 2 },
            { text: 'I build points patiently and look for the right moment to attack', value: 3 },
            { text: 'I construct points with purpose, control tempo, and finish efficiently', value: 4 },
        ],
    },
    {
        id: 'competition',
        category: 'Competition',
        weight: 1.5,
        question: "What's your competitive experience in padel?",
        options: [
            { text: 'I only play socially with friends', value: 0, ceiling: 4.0 },
            { text: 'I play club open play / round robins', value: 1, ceiling: 4.25 },
            { text: "I've played in a few local tournaments", value: 2, ceiling: 4.75 },
            { text: 'I compete regularly in local/regional tournaments', value: 3, ceiling: 5.5 },
            { text: 'I compete at a high level and usually place in tournaments', value: 4, ceiling: 6.0 },
        ],
    },
];

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
            }
        } catch (error) {
            console.error('Failed to save assessment:', error);
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
