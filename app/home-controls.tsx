"use client";

import { useState } from "react";
import ResetButton from "./reset-button";
import RunSimulationButton from "./run-simulation-button";

export default function HomeControls() {
  const [resetRunning, setResetRunning] = useState(false);
  const [simRunning, setSimRunning] = useState(false);

  return (
    <>
      <ResetButton disabled={simRunning} onRunningChange={setResetRunning} />
      <RunSimulationButton disabled={resetRunning} onRunningChange={setSimRunning} />
    </>
  );
}
