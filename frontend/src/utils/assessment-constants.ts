export const QUESTIONS = [
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
            { text: 'I control the net well and consistently place volleys deep within a foot of the wall', value: 3 },
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
            { text: "I've played in a few local organized tournaments", value: 2, ceiling: 4.75 },
            { text: 'I compete regularly in local/regional tournaments', value: 3, ceiling: 5.5 },
            { text: 'I compete at a high level and usually place in tournaments', value: 4, ceiling: 6.0 },
        ],
    },
];
export const calculateRating = (answers: Record<string, number>) => {
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

export const getRatingDescription = (rating: number) => {
    if (rating < 2.5) return { level: 'Beginner', desc: "You're just getting started with padel. Focus on fundamentals: grip, basic strokes, and understanding the rules." };
    if (rating < 3.0) return { level: 'Advanced Beginner', desc: 'You understand the basics and can sustain rallies. Work on consistency and start learning the walls.' };
    if (rating < 3.5) return { level: 'Intermediate', desc: "You're comfortable in social games with developing wall play. Keep working on the bandeja and court positioning." };
    if (rating < 4.0) return { level: 'Solid Intermediate', desc: 'You have a well-rounded game and compete well in club play. Focus on point construction and overhead shots.' };
    if (rating < 4.5) return { level: 'Advanced Intermediate', desc: "You're a strong club player who can handle most situations. Refine your tactical game and specialty shots." };
    if (rating < 5.0) return { level: 'Advanced', desc: "You're among the better players at most clubs. You have weapons and few weaknesses. Tournament-ready." };
    if (rating < 5.5) return { level: 'Strong Advanced', desc: 'You compete and place in tournaments. Your game is well-rounded with tactical depth.' };
    return { level: 'Expert', desc: "You're at or near the top level of amateur play. You should be competing in high-level tournaments." };
};

export const getMatchRange = (rating: number) => {
    const low = Math.max(2.0, rating - 0.5);
    const high = Math.min(6.0, rating + 0.5);
    return `${low.toFixed(2)} - ${high.toFixed(2)}`;
};
