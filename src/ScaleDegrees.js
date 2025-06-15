import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

const TONICS = ["C2", "D2", "E2", "F2", "G2", "A2", "B2"];
const SCALE_DEGREES = [
    { label: "1", semitones: 0 },
    { label: "b2", semitones: 1 },
    { label: "2", semitones: 2 },
    { label: "b3", semitones: 3 },
    { label: "3", semitones: 4 },
    { label: "4", semitones: 5 },
    { label: "b5", semitones: 6 },
    { label: "5", semitones: 7 },
    { label: "b6", semitones: 8 },
    { label: "6", semitones: 9 },
    { label: "b7", semitones: 10 },
    { label: "7", semitones: 11 },
];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteFromTonic(tonic, semitones) {
    // tonic like "C2"
    const match = tonic.match(/^([A-G]#?)(\d)$/);
    if (!match) return tonic;
    const [ , note, octaveStr ] = match;
    const octave = parseInt(octaveStr, 10);
    const tonicIdx = NOTE_NAMES.indexOf(note);
    const absIdx = tonicIdx + octave * 12 + semitones;
    const newOctave = Math.floor(absIdx / 12);
    const newNoteIdx = ((absIdx % 12) + 12) % 12;
    return NOTE_NAMES[newNoteIdx] + newOctave;
}

const ACCURACY_KEY = "scale_degree_accuracy";
const ENABLED_DEGREES_KEY = "scale_degree_enabled";

export default function PlayC4Button() {
    // Load from localStorage or use defaults
    const [accuracy, setAccuracy] = useState(() => {
        const stored = localStorage.getItem(ACCURACY_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length === SCALE_DEGREES.length) {
                    return parsed;
                }
            } catch {}
        }
        return SCALE_DEGREES.map(() => ({ correct: 0, total: 0 }));
    });

    const [enabledDegrees, setEnabledDegrees] = useState(() => {
        const stored = localStorage.getItem(ENABLED_DEGREES_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length === SCALE_DEGREES.length) {
                    return parsed;
                }
            } catch {}
        }
        return SCALE_DEGREES.map(() => true);
    });

    const [lastTonic, setLastTonic] = useState(null);
    const [lastDegree, setLastDegree] = useState(null);
    const [showDegree, setShowDegree] = useState(false);
    const [awaitingAnswer, setAwaitingAnswer] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [question, setQuestion] = useState(null);
    const synthRef = useRef(null);

    // Save accuracy and enabledDegrees to localStorage when they change
    useEffect(() => {
        localStorage.setItem(ACCURACY_KEY, JSON.stringify(accuracy));
    }, [accuracy]);

    useEffect(() => {
        localStorage.setItem(ENABLED_DEGREES_KEY, JSON.stringify(enabledDegrees));
    }, [enabledDegrees]);

    const playRandom = async () => {
        await Tone.start();
        setShowDegree(false);
        setFeedback("");

        // Stop previous synth if exists
        if (synthRef.current) {
            synthRef.current.releaseAll();
            synthRef.current.dispose();
            synthRef.current = null;
        }

        // Only pick from enabled scale degrees
        const enabledList = SCALE_DEGREES.filter((_, i) => enabledDegrees[i]);
        if (enabledList.length === 0) return;

        let tonic, degree;
        // If awaitingAnswer, repeat the same question
        if (awaitingAnswer && question) {
            tonic = question.tonic;
            degree = question.degree;
        } else {
            tonic = TONICS[Math.floor(Math.random() * TONICS.length)];
            degree = enabledList[Math.floor(Math.random() * enabledList.length)];
            setLastTonic(tonic);
            setLastDegree(degree);
            setQuestion({ tonic, degree });
            setAwaitingAnswer(true);
        }
        setLastTonic(tonic);
        setLastDegree(degree);

        // Create and store new synth
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        synthRef.current = synth;

        // Play tonic
        synth.triggerAttackRelease([tonic], 10);

        // After 1 second, play scale degree
        const note = getNoteFromTonic(tonic, degree.semitones);
        synth.triggerAttackRelease([note], 7, Tone.now() + 3);
        setShowDegree(true);
    };

    function toggleDegree(idx) {
        setEnabledDegrees(prev => {
            const updated = [...prev];
            // Prevent disabling all degrees
            if (updated.filter(Boolean).length === 1 && updated[idx]) return updated;
            updated[idx] = !updated[idx];
            return updated;
        });
    }

    function handleTonicAnswer(selectedDegreeLabel) {
        if (!awaitingAnswer) return;
        setAwaitingAnswer(false);
        setQuestion(null);
        const correct = selectedDegreeLabel === lastDegree.label;
        const idx = SCALE_DEGREES.findIndex(d => d.label === lastDegree.label && d.semitones === lastDegree.semitones);
        setAccuracy(prev => {
            const updated = prev.map((cell, i) =>
                i === idx
                    ? {
                        correct: cell.correct + (correct ? 1 : 0),
                        total: cell.total + 1
                    }
                    : cell
            );
            return updated;
        });
        setFeedback(correct ? "✅ Correct!" : `❌ Incorrect. The answer was ${lastDegree.label}`);
    }

    return (
        <div className="flex flex-col justify-center items-center min-h-[70vh] bg-gradient-to-b from-blue-50 to-white p-4">
            <h2 className="text-2xl font-bold mb-4 text-blue-800 drop-shadow">Scale Degree Ear Trainer</h2>
            <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {SCALE_DEGREES.map((deg, idx) => (
                    <button
                        key={deg.label + idx}
                        onClick={() => toggleDegree(idx)}
                        className={`px-3 py-1 rounded-full border text-sm font-mono transition
                            ${enabledDegrees[idx]
                                ? 'bg-blue-500 text-white border-blue-700 shadow-md'
                                : 'bg-gray-200 text-gray-600 border-gray-400'}
                            `}
                        disabled={enabledDegrees.filter(Boolean).length === 1 && enabledDegrees[idx]}
                        title={deg.label}
                    >
                        {deg.label}
                    </button>
                ))}
            </div>
            <button
                onClick={playRandom}
                className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition mb-4"
            >
                ▶️ Play Random Tonic & Degree
            </button>
            {showDegree && lastDegree && (
                <div className="mt-4 text-lg bg-blue-100 px-4 py-2 rounded shadow">
                    Scale degree played: <span className="font-mono font-bold text-blue-700">{lastDegree.label}</span>
                </div>
            )}
            {true && (
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                    {SCALE_DEGREES.map((deg, idx) => (
                        enabledDegrees[idx] && (
                            <button
                                key={deg.label + idx}
                                onClick={() => handleTonicAnswer(deg.label)}
                                className="px-4 py-2 bg-white border border-blue-300 rounded-lg font-mono text-blue-700 hover:bg-blue-100 shadow transition"
                            >
                                {deg.label}
                            </button>
                        )
                    ))}
                </div>
            )}
            {feedback && (
                <div className={`h-[100px] p-10 text-lg font-semibold ${feedback.startsWith("✅") ? "text-green-700" : "text-red-700"}`}>
                    {feedback}
                </div>
            )}
            {!feedback &&
                <div className="h-[100px]">
                </div>
            }
            {/* Accuracy Table */}
            <div className="overflow-x-auto mt-10 w-full max-w-md">
                <table className="text-sm border-collapse w-full shadow rounded">
                    <thead>
                        <tr>
                            <th className="border px-3 py-2 bg-blue-100 text-blue-800">Degree</th>
                            <th className="border px-3 py-2 bg-blue-100 text-blue-800">Accuracy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SCALE_DEGREES.map((deg, idx) => {
                            const { correct, total } = accuracy[idx];
                            const percent = total > 0 ? ((correct / total) * 100).toFixed(0) : "-";
                            return (
                                <tr key={deg.label + idx}>
                                    <td className="border px-3 py-2 font-mono">{deg.label}</td>
                                    <td className="border px-3 py-2 text-center">
                                        {total > 0 ? (
                                            <span className={percent >= 80 ? "text-green-700 font-bold" : percent >= 50 ? "text-yellow-700 font-bold" : "text-red-700 font-bold"}>
                                                {correct}/{total} ({percent}%)
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}