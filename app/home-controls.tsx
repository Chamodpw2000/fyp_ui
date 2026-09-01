"use client";

import { useState } from "react";
import ResetButton from "./reset-button";
import RunSimulationButton, { type SimulationMode } from "./run-simulation-button";

export default function HomeControls() {
  const [lightweightRunning, setLightweightRunning] = useState(false);
  const [drlRunning, setDrlRunning] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [mode, setMode] = useState<SimulationMode>(null);
  // Which reset owns the shared "View logs" slot — the one clicked most recently.
  const [logOwner, setLogOwner] = useState<"lightweight" | "drl" | null>(null);

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
          onComplete={() => setMode("lightweight")}
          onActivate={() => setLogOwner("lightweight")}
          showLogs={logOwner === "lightweight"}
        />
        <ResetButton
          target="drl"
          label="Reset DRL agent mode"
          logTitle="Reset DRL agent mode output"
          disabled={anyBusy && !drlRunning}
          onRunningChange={setDrlRunning}
          onComplete={() => setMode("drl")}
          onActivate={() => setLogOwner("drl")}
          showLogs={logOwner === "drl"}
        />
      </div>
      <RunSimulationButton
        mode={mode}
        disabled={anyBusy && !simRunning}
        onRunningChange={setSimRunning}
      />
    </>
  );
}
