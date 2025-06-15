import React, { useState, useRef, useEffect } from "react";
import * as Tone from "tone";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
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

const KEYS = NOTE_NAMES.map((n) => n + "4");

const CHORDS = [
    { name: "I", intervals: [0, 4, 7] },
    { name: "ii", intervals: [2, 5, 9] },
    { name: "iii", intervals: [4, 7, 11] },
    { name: "IV", intervals: [5, 9, 12] },
    { name: "V", intervals: [7, 11, 14] },
    { name: "vi", intervals: [9, 12, 16] },
    { name: "vii°", intervals: [11, 14, 17] }
];

function getNoteFromKeyAndDegree(key, degree, octave = 4) {
    const keyName = key.replace(/\d/, "");
    const keyOctave = parseInt(key.replace(/[^0-9]/g, ""), 10);
    const keyIdx = NOTE_NAMES.indexOf(keyName);
    const absIdx = keyIdx + degree.semitones;
    const noteName = NOTE_NAMES[(absIdx + 12) % 12];
    const noteOctave = keyOctave + Math.floor((keyIdx + degree.semitones) / 12);
    return noteName + (octave ?? noteOctave);
}

function getChordNotes(key, chord, octave = 4) {
    const keyName = key.replace(/\d/, "");
    const keyOctave = parseInt(key.replace(/[^0-9]/g, ""), 10);
    const keyIdx = NOTE_NAMES.indexOf(keyName);
    return chord.intervals.map((interval, i) => {
        const absIdx = keyIdx + interval;
        const noteName = NOTE_NAMES[(absIdx + 12) % 12];
        const noteOctave = keyOctave + Math.floor((keyIdx + interval) / 12) + (i > 0 ? 1 : 0);
        return noteName + (octave ?? noteOctave);
    });
}

const STORAGE_KEY = "randomMelodyPlayerSettings";

export default function RandomMelodyPlayer() {
    // Load settings from localStorage or use defaults
    const getInitialSettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved) {
                return {
                    selectedKey: saved.selectedKey || "C4",
                    bpm: saved.bpm || 120,
                    enabledDegrees: Array.isArray(saved.enabledDegrees)
                        ? saved.enabledDegrees
                        : SCALE_DEGREES.map(() => true),
                    progression: Array.isArray(saved.progression) && saved.progression.length === 4
                        ? saved.progression
                        : [0, 3, 4, 0],
                    enabledChords: Array.isArray(saved.enabledChords)
                        ? saved.enabledChords
                        : CHORDS.map(() => true),
                };
            }
        } catch { }
        return {
            selectedKey: "C4",
            bpm: 120,
            enabledDegrees: SCALE_DEGREES.map(() => true),
            progression: [0, 3, 4, 0],
            enabledChords: CHORDS.map(() => true),
        };
    };

    const initial = getInitialSettings();

    const [selectedKey, setSelectedKey] = useState(initial.selectedKey);
    const [enabledDegrees, setEnabledDegrees] = useState(initial.enabledDegrees);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progression, setProgression] = useState(initial.progression);
    const [bpm, setBpm] = useState(initial.bpm);
    const [lastPlayedDegree, setLastPlayedDegree] = useState(null);
    const [oneCounter, setOneCounter] = useState(0);
    const [missedOneCounter, setMissedOneCounter] = useState(0);
    const [arpeggiateChords, setArpeggiateChords] = useState(true);
    const [userGuesses, setUserGuesses] = useState(Array(12).fill(null));
    const [userChordGuesses, setUserChordGuesses] = useState(Array(4).fill(null));
    const [flashColIdx, setFlashColIdx] = useState(null);
    const [showAnswers, setShowAnswers] = useState(false);
    const [enabledChords, setEnabledChords] = useState(initial.enabledChords);

    // Flash states
    const [flashOne, setFlashOne] = useState(false);
    const [flashMissed, setFlashMissed] = useState(false);

    const synthRef = useRef(null);
    const chordSynthRef = useRef(null);
    const loopRef = useRef(null);
    const melodyCountRef = useRef(0);
    const chordIndexRef = useRef(0);
    const lastOneClickedRef = useRef(false);
    const lastPlayedDegreeRef = useRef(null);

    // New refs for generated melody
    const generatedMelodyRef = useRef([]);
    const generatedMelodyOctavesRef = useRef([]);
    const melodyPlayIdxRef = useRef(0);

    // 1. Add a new state to track the flashing chord column index:
    const [flashChordColIdx, setFlashChordColIdx] = useState(null);

    // Add state for tonic drone
    const [playTonicDrone, setPlayTonicDrone] = useState(false);

    // Add a ref for the drone synth
    const droneSynthRef = useRef(null);

    // Add this state near your other useState hooks:
    const [incorrectMelodyGuesses, setIncorrectMelodyGuesses] = useState(
        Array(12).fill(null).map(() => ({}))
    );
    const [incorrectChordGuesses, setIncorrectChordGuesses] = useState(
        Array(4).fill(null).map(() => ({}))
    );

    // Add a new state for harmonic chords
    const [playChordsHarmonically, setPlayChordsHarmonically] = useState(false);

    // Save settings to localStorage when they change
    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                selectedKey,
                bpm,
                enabledDegrees,
                progression,
                enabledChords,
            })
        );
    }, [selectedKey, bpm, enabledDegrees, progression, enabledChords]);

    const toggleDegree = (idx) => {
        setEnabledDegrees((prev) => {
            const updated = [...prev];
            if (updated.filter(Boolean).length === 1 && updated[idx]) return updated;
            updated[idx] = !updated[idx];
            return updated;
        });
    };

    const toggleChord = (idx) => {
        setEnabledChords((prev) => {
            if (prev.filter(Boolean).length === 1 && prev[idx]) return prev;
            const updated = [...prev];
            updated[idx] = !updated[idx];
            return updated;
        })
    };

    // Function to generate a random melody sequence
    function generateMelodySequence() {
        const enabledList = SCALE_DEGREES.filter((_, i) => enabledDegrees[i]);
        let melody = [];
        let octaves = [];
        let lastDegreeIdx = Math.floor(Math.random() * enabledList.length);
        let lastOctave = 4;
        for (let i = 0; i < 12; i++) {
            let jumps = [-4, -3, -2, -1, 1, 2, 3, 4].filter(j =>
                enabledList[(lastDegreeIdx + j + enabledList.length) % enabledList.length]
            );
            let jump = jumps[Math.floor(Math.random() * jumps.length)];
            let idx = (lastDegreeIdx + jump + enabledList.length) % enabledList.length;
            if (jump > 0 && idx < lastDegreeIdx) lastOctave++;
            if (jump < 0 && idx > lastDegreeIdx) lastOctave--;
            if (lastOctave < 3) lastOctave = 3;
            if (lastOctave > 5) lastOctave = 5;
            melody.push(enabledList[idx]);
            octaves.push(lastOctave);
            lastDegreeIdx = idx;
        }
        generatedMelodyRef.current = melody;
        generatedMelodyOctavesRef.current = octaves;
        melodyPlayIdxRef.current = 0;
    }

    function randomiseProgression() {
        const allowedChordIndexes = CHORDS.map((_, idx) => idx).filter(idx => enabledChords[idx]);
        const newProg = [
            0,
            ...Array.from({ length: 3 }, () =>
                allowedChordIndexes[Math.floor(Math.random() * allowedChordIndexes.length)]
            ),
        ];
        setProgression(newProg);
    }

    const playMelody = async (options = {}) => {
        await Tone.start();
        Tone.Transport.bpm.value = bpm;
        if (!synthRef.current) {
            synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
        }
        if (!chordSynthRef.current) {
            chordSynthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
        }
        if (!droneSynthRef.current) {
            droneSynthRef.current = new Tone.Synth(
                // oscillator: { type: "sine" },
                // envelope: { attack: 0.2, release: 1 }
            ).toDestination();
        }
        setIsPlaying(true);

        if (loopRef.current) loopRef.current.dispose();

        melodyCountRef.current = 0;
        chordIndexRef.current = 0;
        lastOneClickedRef.current = false;
        lastPlayedDegreeRef.current = null;

        if (!options.skipGenerate) {
            randomiseProgression();
            generateMelodySequence();
        }

        setUserGuesses(Array(12).fill(null));
        setUserChordGuesses(Array(4).fill(null));

        // Start tonic drone if enabled
        if (playTonicDrone) {
            const tonic = getNoteFromKeyAndDegree(selectedKey, SCALE_DEGREES[0], 2);
            console.log(tonic)
            droneSynthRef.current.triggerAttack(tonic);
        }

        const beatIntervalSeconds = 60 / bpm;
        let beatInMeasure = 0;

        loopRef.current = new Tone.Loop((time) => {
            const enabledList = SCALE_DEGREES.filter((_, i) => enabledDegrees[i]);
            if (enabledList.length === 0) return;

            if (!playTonicDrone && arpeggiateChords) {
                // Arpeggio
                const chordIdx = progression[chordIndexRef.current];
                const chord = CHORDS[chordIdx];
                const notes = getChordNotes(selectedKey, chord, 2);
                notes.forEach((note, i) => {
                    chordSynthRef.current.triggerAttackRelease(
                        note,
                        "12n",
                        time + i * Tone.Time("12n").toSeconds()
                    );
                });
            } else if (!playTonicDrone && playChordsHarmonically) {
                // Harmonic (all notes at once)
                const chordIdx = progression[chordIndexRef.current];
                const chord = CHORDS[chordIdx];
                const notes = getChordNotes(selectedKey, chord, 2);
                // Change envelope by setting options on the synth
                chordSynthRef.current.set({
                    envelope: {
                        attack: 0.0,
                        decay: 1.0,
                        sustain: 0.8,
                        release: 2.0
                    },
                    volume: -8 // Set to 0 dB for constant volume (adjust as needed)
                });
                chordSynthRef.current.triggerAttackRelease(
                    notes,
                    "5n",
                    time,
                );
            }

            if (beatInMeasure === 1 || beatInMeasure == 3) {
                const idx = melodyPlayIdxRef.current % 12;
                const degree = generatedMelodyRef.current[idx];
                const octave = generatedMelodyOctavesRef.current[idx];
                if (!degree) return;

                const note = getNoteFromKeyAndDegree(selectedKey, degree, octave);
                synthRef.current.triggerAttackRelease(note, "5n", time)
                setLastPlayedDegree(degree.label);
                lastPlayedDegreeRef.current = degree.label;

                melodyPlayIdxRef.current = (melodyPlayIdxRef.current + 1) % 12;
                setFlashColIdx(null);
                setFlashColIdx(idx);
            }

            beatInMeasure = (beatInMeasure + 1) % 4;
            if (beatInMeasure === 0) {
                chordIndexRef.current = (chordIndexRef.current + 1) % progression.length;
            }
            if (beatInMeasure === 1) {
                setFlashChordColIdx(null);
                setFlashChordColIdx(chordIndexRef.current);
            }
        }, beatIntervalSeconds);

        Tone.getTransport().start();
        loopRef.current.start(0);
    };

    const stopMelody = () => {
        setIsPlaying(false);
        if (loopRef.current) {
            loopRef.current.stop();
            loopRef.current.dispose();
            loopRef.current = null;
        }
        if (synthRef.current) synthRef.current.releaseAll();
        if (chordSynthRef.current) chordSynthRef.current.releaseAll();
        if (droneSynthRef.current) droneSynthRef.current.triggerRelease();
        Tone.getTransport().stop();
    };

    // Helper to handle user guess
    function handleGuess(noteIdx, degreeLabel) {
        setUserGuesses(prev => {
            const updated = [...prev];
            updated[noteIdx] = degreeLabel;
            return updated;
        });
    }

    // Helper to handle user chord guess
    function handleChordGuess(idx, chordIdx) {
        setUserChordGuesses(prev => {
            const updated = [...prev];
            updated[idx] = chordIdx;
            return updated;
        });
    }

    // Generate a new chord progression and melody, and reset guesses
    function handleNewQuestion() {
        randomiseProgression();
        generateMelodySequence();
        setUserGuesses(Array(12).fill(null));
        setUserChordGuesses(Array(4).fill(null));
        melodyPlayIdxRef.current = 0;
        chordIndexRef.current = 0;
        setLastPlayedDegree(null);
        setIsPlaying(false);
        setShowAnswers(false);
        if (loopRef.current) {
            loopRef.current.stop();
            loopRef.current.dispose();
            loopRef.current = null;
        }
        if (synthRef.current) synthRef.current.releaseAll();
        if (chordSynthRef.current) chordSynthRef.current.releaseAll();
        Tone.getTransport().stop();
    }

    return (
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-50 to-purple-100 rounded-xl shadow-lg p-8 mt-10 border border-blue-200">
            <h2 className="text-3xl font-extrabold mb-6 text-blue-800 drop-shadow text-center tracking-tight">
                🎵 Melodic Ear Trainer
            </h2>
            <div className="mb-6 flex flex-wrap gap-6 items-center justify-center">
                <label className="font-semibold">Key:</label>
                <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className="border-2 border-blue-300 rounded px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                    {KEYS.map((key) => (
                        <option key={key} value={key}>
                            {key}
                        </option>
                    ))}
                </select>
            </div>
            <div className="mb-6 flex flex-wrap gap-4 items-center justify-center">
                <label className="font-semibold">Speed (BPM):</label>
                <input
                    type="range"
                    max={240}
                    value={bpm}
                    onChange={e => setBpm(Number(e.target.value))}
                    className="w-48 accent-blue-500"
                />
                <input
                    type="number"
                    max={240}
                    value={bpm}
                    onChange={e => {
                        let val = Number(e.target.value);
                        if (isNaN(val)) val = 60;
                        if (val > 240) val = 240;
                        setBpm(val);
                    }}
                    className="border-2 border-blue-300 rounded px-2 py-1 w-20 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="font-mono text-blue-700">{bpm} BPM</span>
            </div>
            <div className="mb-6">
                <div className="font-semibold mb-2">Scale Degrees:</div>
                <div className="flex flex-wrap gap-2">
                    {SCALE_DEGREES.map((deg, idx) => (
                        <button
                            key={deg.label + idx}
                            onClick={() => toggleDegree(idx)}
                            className={`px-4 py-2 rounded-full border-2 text-sm font-mono transition-all duration-150
                            ${enabledDegrees[idx]
                                    ? 'bg-gradient-to-r from-blue-400 to-blue-600 text-white border-blue-700 shadow-md hover:from-blue-500 hover:to-blue-700'
                                    : 'bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200'}
                        `}
                            disabled={enabledDegrees.filter(Boolean).length === 1 && enabledDegrees[idx]}
                            title={deg.label}
                        >
                            {deg.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="mb-6">
                <div className="font-semibold mb-2">Chords:</div>
                <div className="flex flex-wrap gap-2">
                    {CHORDS.map((chord, idx) => (
                        <button
                            key={chord.name}
                            onClick={() => toggleChord(idx)}
                            className={`px-4 py-2 rounded-full border-2 text-sm font-mono transition-all duration-150
                                ${enabledChords[idx]
                                    ? 'bg-gradient-to-r from-purple-400 to-purple-600 text-white border-purple-700 shadow-md hover:from-purple-500 hover:to-purple-700'
                                    : 'bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200'}
                            `}
                            disabled={enabledChords.filter(Boolean).length === 1 && enabledChords[idx]}
                            title={chord.name}
                        >
                            {chord.name}
                        </button>
                    ))}
                </div>
            </div>
            <div className="mb-6 flex items-center gap-8">
                <label className="font-semibold">Accompaniment:</label>
                <label className="flex items-center gap-2">
                    <input
                        type="radio"
                        checked={!playTonicDrone && arpeggiateChords && !playChordsHarmonically}
                        onChange={() => {
                            setPlayTonicDrone(false);
                            setArpeggiateChords(true);
                            setPlayChordsHarmonically(false);
                        }}
                        className="accent-purple-500"
                    />
                    <span>Arpeggio</span>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="radio"
                        checked={!playTonicDrone && playChordsHarmonically}
                        onChange={() => {
                            setPlayTonicDrone(false);
                            setArpeggiateChords(false);
                            setPlayChordsHarmonically(true);
                        }}
                        className="accent-green-500"
                    />
                    <span>Harmonic</span>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="radio"
                        checked={playTonicDrone}
                        onChange={() => {
                            setPlayTonicDrone(true);
                            setArpeggiateChords(false);
                            setPlayChordsHarmonically(false);
                        }}
                        className="accent-blue-500"
                    />
                    <span>Tonic drone</span>
                </label>
            </div>
            <div className="flex gap-6 mt-6 justify-center">
                {!isPlaying && (
                    <button
                        onClick={() => {
                            if (!generatedMelodyRef.current || generatedMelodyRef.current.length === 0) {
                                generateMelodySequence();
                            }
                            melodyPlayIdxRef.current = 0;
                            chordIndexRef.current = 0;
                            setLastPlayedDegree(null);
                            setIsPlaying(true);

                            if (loopRef.current) {
                                loopRef.current.stop();
                                loopRef.current.dispose();
                                loopRef.current = null;
                            }
                            if (synthRef.current) synthRef.current.releaseAll();
                            if (chordSynthRef.current) chordSynthRef.current.releaseAll();
                            Tone.getTransport().stop();

                            playMelody({ skipGenerate: true });
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-8 rounded shadow-lg text-xl transition-all duration-150"
                    >
                        ▶️ Play Melody
                    </button>
                )}
                {isPlaying && (
                    <button
                        onClick={stopMelody}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-8 rounded shadow-lg text-xl transition-all duration-150"
                    >
                        ⏹ Stop Melody
                    </button>
                )}
                <button
                    onClick={handleNewQuestion}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded shadow transition-all duration-150"
                >
                    ➡️ Next Question
                </button>
            </div>
            <div className="flex justify-center my-6">
                <button
                    onClick={() => setShowAnswers(true)}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-8 rounded shadow-lg text-lg transition-all duration-150"
                    disabled={showAnswers}
                >
                    Check Answer
                </button>
                {showAnswers && (
                    <button
                        onClick={() => setShowAnswers(false)}
                        className="ml-4 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-8 rounded shadow-lg text-lg transition-all duration-150"
                    >
                        Hide Answers
                    </button>
                )}
            </div>

            {/* Guess the Chord Progression Table */}
            <div className="mb-10 overflow-x-auto">
                <div className="font-semibold mb-3 text-lg text-purple-900">Guess the Chord Progression:</div>
                <div className="flex flex-col rounded-xl border border-purple-200 bg-white shadow-sm p-4">
                    {/* Column headers */}
                    <div className="flex mb-1">
                        <div className="w-24 flex-shrink-0"></div>
                        <div className="flex">
                            {[0, 1, 2, 3].map((idx) => (
                                <div
                                    key={idx}
                                    className={`w-16 text-center font-mono text-xs text-gray-600 flex-shrink-0 rounded-t-lg
                    ${flashChordColIdx === idx ? "bg-yellow-200" : ""}`}
                                    style={{ minWidth: "4rem", height: "2rem" }}
                                >
                                    {idx + 1}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Button grid */}
                    {CHORDS.map((chord, rowIdx) => (
                        <div key={chord.name} className="flex items-center">
                            <div className="w-24 text-right pr-2 font-mono text-sm text-gray-700 flex-shrink-0">{chord.name}</div>
                            <div className="flex">
                                {[0, 1, 2, 3].map((colIdx) => {
                                    const isCorrect = progression[colIdx] === rowIdx;
                                    const isSelected = userChordGuesses[colIdx] === rowIdx;
                                    let buttonContent = "";
                                    if (isSelected) {
                                        if (!showAnswers) {
                                            buttonContent = "?";
                                        } else {
                                            buttonContent = isCorrect ? "✓" : "✗";
                                        }
                                    }
                                    return (
                                        <button
                                            key={colIdx}
                                            className={`w-16 h-9 m-0.5 rounded-lg border-2 font-mono text-base flex-shrink-0
                                    ${showAnswers && isSelected
                                                    ? (isCorrect
                                                        ? "bg-green-400 border-green-700 text-white"
                                                        : "bg-red-300 border-red-500 text-white")
                                                    : "bg-gray-50 border-gray-300 text-gray-700"}
                                            hover:bg-purple-100 transition-all shadow-sm`}
                                            style={{ minWidth: "4rem" }}
                                            onClick={() => handleChordGuess(colIdx, rowIdx)}
                                        >
                                            {isSelected ? buttonContent : ""}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Guess the Melody Sequence Table */}
            <div className="mb-10 overflow-x-auto">
                <div className="font-semibold mb-3 text-lg text-blue-900">Guess the Melody Sequence:</div>
                <div className="flex flex-col rounded-xl border border-blue-200 bg-white shadow-sm p-4">
                    {/* Column headers */}
                    <div className="flex mb-1">
                        <div className="w-16 flex-shrink-0"></div>
                        <div className="flex">
                            {generatedMelodyRef.current.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`flex flex-col items-center justify-center ${flashColIdx === idx ? "bg-yellow-200" : ""} rounded-t-lg`}
                                    style={{ minWidth: "3rem", width: "3rem", height: "2rem" }}
                                >
                                    <span className="font-mono text-xs text-gray-600">{idx + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Button grid */}
                    {SCALE_DEGREES.filter((_, idx) => enabledDegrees[idx]).map((deg, rowIdx) => (
                        <div key={deg.label} className="flex items-center">
                            <div className="w-16 text-right pr-2 font-mono text-sm text-gray-700 flex-shrink-0">{deg.label}</div>
                            <div className="flex">
                                {generatedMelodyRef.current.map((_, colIdx) => {
                                    const isCorrect =
                                        generatedMelodyRef.current[colIdx] &&
                                        generatedMelodyRef.current[colIdx].label === deg.label;
                                    const isSelected = userGuesses[colIdx] === deg.label;
                                    let buttonContent = "";
                                    if (isSelected) {
                                        if (!showAnswers) {
                                            buttonContent = "?";
                                        } else {
                                            buttonContent = isCorrect ? "✓" : "✗";
                                        }
                                    }
                                    return (
                                        <div
                                            key={colIdx}
                                            className="flex flex-col items-center"
                                            style={{ minWidth: "3rem", width: "3rem" }}
                                        >
                                            <button
                                                className={`w-12 h-9 m-0.5 rounded-lg border-2 font-mono text-base flex-shrink-0
                                ${showAnswers && isSelected
                                                        ? (isCorrect
                                                            ? "bg-green-400 border-green-700 text-white"
                                                            : "bg-red-300 border-red-500 text-white")
                                                        : "bg-gray-50 border-gray-300 text-gray-700"}
                                hover:bg-blue-100 transition-all shadow-sm`}
                                                style={{ minWidth: "3rem" }}
                                                onClick={() => handleGuess(colIdx, deg.label)}
                                            >
                                                {isSelected ? buttonContent : ""}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>


        </div>
    );
}