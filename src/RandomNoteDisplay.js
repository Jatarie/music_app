import React, { useState, useEffect } from "react";

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function getRandomNote() {
    return NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)];
}

export default function RandomNoteDisplay() {
    const [note, setNote] = useState(getRandomNote());

    useEffect(() => {
        const interval = setInterval(() => {
            setNote(getRandomNote());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="text-6xl font-bold text-blue-700 mb-4">{note}</div>
            <div className="text-gray-500">A new note appears every 5 seconds</div>
        </div>
    );
}