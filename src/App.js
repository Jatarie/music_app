import React, { useState, useEffect } from "react";
import IntervalNames from "./IntervalNames";
import ScaleDegrees from "./ScaleDegrees";
import RandomMelodyPlayer from "./RandomMelodyPlayer";
import "./output.css";

const TAB_STORAGE_KEY = "musicAppSelectedTab";

function App() {
  // Load tab from localStorage or default to "scale"
  const getInitialTab = () => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY);
      return saved || "scale";
    } catch {
      return "scale";
    }
  };

  const [tab, setTab] = useState(getInitialTab());

  // Save tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  return (
    <div className="App">
      <header>
        <div className="flex flex-col items-center">
          <div className="flex mb-4 mt-4 space-x-2">
            <button
              className={`px-4 py-2 rounded-t ${
                tab === "scale"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-gray-200 text-gray-600"
              }`}
              onClick={() => setTab("scale")}
            >
              Scale Degrees
            </button>
            <button
              className={`px-4 py-2 rounded-t ${
                tab === "interval"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-gray-200 text-gray-600"
              }`}
              onClick={() => setTab("interval")}
            >
              Interval Names
            </button>
            <button
              className={`px-4 py-2 rounded-t ${
                tab === "melody"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-gray-200 text-gray-600"
              }`}
              onClick={() => setTab("melody")}
            >
              Random Melody
            </button>
          </div>
          <div className="w-full bg-white rounded-b shadow p-4">
            {tab === "scale" && <ScaleDegrees />}
            {tab === "interval" && <IntervalNames />}
            {tab === "melody" && <RandomMelodyPlayer />}
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
