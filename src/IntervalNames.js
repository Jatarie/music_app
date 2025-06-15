import React, { useState, useRef } from 'react';
import * as Tone from 'tone';


const NOTES = [
	'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F',
	'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'
];
const NOTE_ANSWERS = [
	'C', 'C#', 'D', 'D#', 'E', 'F',
	'F#', 'G', 'G#', 'A', 'A#', 'B'
];
const INTERVALS = [
	{ name: 'minor 2nd', semitones: 1 },
	{ name: 'major 2nd', semitones: 2 },
	{ name: 'minor 3rd', semitones: 3 },
	{ name: 'major 3rd', semitones: 4 },
	{ name: 'perfect 4th', semitones: 5 },
	{ name: 'tritone', semitones: 6 },
	{ name: 'perfect 5th', semitones: 7 },
	{ name: 'minor 6th', semitones: 8 },
	{ name: 'major 6th', semitones: 9 },
	{ name: 'minor 7th', semitones: 10 },
	{ name: 'major 7th', semitones: 11 },
	{ name: 'octave', semitones: 12 },
];

function getRandomItem(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function getNoteIndex(note) {
	return NOTE_ANSWERS.indexOf(note);
}

function getNoteFromInterval(startNote, semitones, direction) {
	const startIdx = getNoteIndex(startNote);
	let idx;
	if (direction === 'ascending') {
		idx = (startIdx + semitones) % NOTE_ANSWERS.length;
	} else {
		idx = (startIdx - semitones + NOTE_ANSWERS.length) % NOTE_ANSWERS.length;
	}
	return NOTE_ANSWERS[idx];
}

export default function IntervalNames() {
    const [enabledIntervals, setEnabledIntervals] = useState(
        INTERVALS.map(() => true)
    );
    const [quiz, setQuiz] = useState(() => generateQuiz(INTERVALS, enabledIntervals));
    const [feedback, setFeedback] = useState('');
    const [timings, setTimings] = useState(
        () => Array(NOTE_ANSWERS.length).fill(0).map(() => Array(INTERVALS.length * 2).fill([]))
    );
    const startTimeRef = useRef(Date.now());

    function generateQuiz(intervals, enabled) {
        const enabledList = intervals
            .map((interval, i) => enabled[i] ? interval : null)
            .filter(Boolean);
        const interval = getRandomItem(enabledList);
        const noteIdx = Math.floor(Math.random() * NOTE_ANSWERS.length);
        const note = NOTE_ANSWERS[noteIdx];
        const direction = Math.random() < 0.5 ? 'ascending' : 'descending';
        const answer = getNoteFromInterval(note, interval.semitones, direction);
        return { note, interval, direction, answer };
    }

    function getIntervalColIdx(interval, direction) {
        const intervalIdx = INTERVALS.findIndex(i => i.name === interval.name);
        return intervalIdx * 2 + (direction === 'descending' ? 1 : 0);
    }

    function handleAnswer(note) {
        if (feedback) return;
        const endTime = Date.now();
        const elapsed = (endTime - startTimeRef.current) / 1000; // seconds

        if (note === quiz.answer) {
            const noteIdx = NOTE_ANSWERS.indexOf(quiz.note);
            const colIdx = getIntervalColIdx(quiz.interval, quiz.direction);

            setTimings(prev => {
                const updated = prev.map(row => row.map(cell => [...cell]));
                updated[noteIdx][colIdx] = [...updated[noteIdx][colIdx], elapsed];
                return updated;
            });

            setFeedback('Correct!');
            setTimeout(() => {
                const nextQuiz = generateQuiz(INTERVALS, enabledIntervals);
                setQuiz(nextQuiz);
                setFeedback('');
                startTimeRef.current = Date.now();
            }, 1000);
        } else {
            setFeedback(`Incorrect. The correct answer was ${quiz.answer}.`);
            // Do NOT record the time for incorrect answers
        }
    }

    function handleNext() {
        const nextQuiz = generateQuiz(INTERVALS, enabledIntervals);
        setQuiz(nextQuiz);
        setFeedback('');
        startTimeRef.current = Date.now();
    }

    function toggleInterval(idx) {
        const updated = [...enabledIntervals];
        updated[idx] = !updated[idx];
        setEnabledIntervals(updated);

        // If no intervals are enabled, don't update quiz
        if (updated.some(Boolean)) {
            const nextQuiz = generateQuiz(INTERVALS, updated);
            setQuiz(nextQuiz);
            setFeedback('');
            startTimeRef.current = Date.now();
        }
    }

    const enabledCount = enabledIntervals.filter(Boolean).length;


    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-2xl font-bold mb-2">Interval Quiz</h2>

            <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {INTERVALS.map((interval, idx) => (
                    <button
                        key={interval.name}
                        onClick={() => toggleInterval(idx)}
                        className={`px-2 py-1 rounded border text-xs font-mono
                            ${enabledIntervals[idx]
                                ? 'bg-blue-500 text-white border-blue-700'
                                : 'bg-gray-200 text-gray-600 border-gray-400'}
                            `}
                        disabled={enabledCount === 1 && enabledIntervals[idx]}
                        title={interval.name}
                    >
                        {interval.name}
                    </button>
                ))}
            </div>

            <p className="mb-4 text-xl pb-4 text-center">
                {quiz.note} {quiz.direction} {quiz.interval.name}
            </p>

            <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {NOTES.map((label, idx) => {
                    const isSharpFlat = label.includes('/') || label.includes('#') || label.includes('b');
                    return (
                        <button
                            key={label}
                            onClick={() => handleAnswer(NOTE_ANSWERS[idx])}
                            disabled={!!feedback}
                            className={`min-w-[60px] px-3 py-2 relative ${isSharpFlat ? '-top-4 bg-black text-white' : 'top-0 bg-white text-black'} rounded border border-gray-300 shadow disabled:opacity-50`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
            {feedback && (
                <div className="flex flex-col items-center">
                    <p>{feedback}</p>
                    {feedback.startsWith('Incorrect') && (
                        <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded" onClick={handleNext}>Next</button>
                    )}
                </div>
            )}

            {/* Timing Table */}
            <div className="overflow-x-auto mt-8">
                <table className="text-xs border-collapse">
                    <thead>
                        <tr>
                            <th className="border px-1 py-1 bg-gray-100">Note</th>
                            {INTERVALS.map((interval, i) => (
                                <React.Fragment key={interval.name}>
                                    <th className="border px-1 py-1 bg-gray-100">{interval.name}↑</th>
                                    <th className="border px-1 py-1 bg-gray-100">{interval.name}↓</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {NOTE_ANSWERS.map((note, rowIdx) => (
                            <tr key={note}>
                                <td className="border px-1 py-1 font-bold bg-gray-50">{note}</td>
                                {INTERVALS.map((interval, colIdx) => (
                                    <React.Fragment key={interval.name}>
                                        <td className="border px-1 py-1 text-center">
                                            {(() => {
                                                const arr = timings[rowIdx][colIdx * 2];
                                                const last5 = arr.slice(-5);
                                                const avg = last5.length
                                                    ? (last5.reduce((a, b) => a + b, 0) / last5.length).toFixed(2)
                                                    : '';
                                                let color = '';
                                                if (avg) {
                                                    const avgNum = parseFloat(avg);
                                                    if (avgNum < 3) color = 'text-green-600';
                                                    else if (avgNum < 10) color = 'text-orange-500';
                                                    else color = 'text-red-600';
                                                }
                                                return (
                                                    avg && (
                                                        <span className={`${color} font-semibold block`}>
                                                            {avg}
                                                        </span>
                                                    )
                                                );
                                            })()}
                                        </td>
                                        <td className="border px-1 py-1 text-center">
                                            {(() => {
                                                const arr = timings[rowIdx][colIdx * 2 + 1];
                                                const last5 = arr.slice(-5);
                                                const avg = last5.length
                                                    ? (last5.reduce((a, b) => a + b, 0) / last5.length).toFixed(2)
                                                    : '';
                                                let color = '';
                                                if (avg) {
                                                    const avgNum = parseFloat(avg);
                                                    if (avgNum < 3) color = 'text-green-600';
                                                    else if (avgNum < 10) color = 'text-orange-500';
                                                    else color = 'text-red-600';
                                                }
                                                return (
                                                    avg && (
                                                        <span className={`${color} font-semibold block`}>
                                                            {avg}
                                                        </span>
                                                    )
                                                );
                                            })()}
                                        </td>
                                    </React.Fragment>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}