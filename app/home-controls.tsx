"use client";

import { useState } from "react";
import ResetButton from "./reset-button";
import RunSimulationButton from "./run-simulation-button";

export default function HomeControls() {
  const [lightweightRunning, setLightweightRunning] = useState(false);
  const [drlRunning, setDrlRunning] = useState(false);
  const [simRunning, setSimRunning] = useState(false);

  const anyBusy = lightweightRunning || drlRunning || simRunning;

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <ResetButton
          target="lightweight"
          label="Reset Light weight mode"
          logTitle="Reset light-weight mode output"
          disabled={anyBusy && !lightweightRunning}
          onRunningChange={setLightweightRunning}
        />
        <ResetButton
          target="drl"
          label="Reset DRL agent mode"
          logTitle="Reset DRL agent mode output"
          disabled={anyBusy && !drlRunning}
          onRunningChange={setDrlRunning}
        />
      </div>
      <RunSimulationButton
        disabled={anyBusy && !simRunning}
        onRunningChange={setSimRunning}
      />
    </>
  );
}
