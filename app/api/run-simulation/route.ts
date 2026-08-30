import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Allow long-running ns-3 simulations.
export const maxDuration = 3600;

// Directory that contains the `waf` script (the ns-3 root).
// Override with the NS3_DIR environment variable.
const NS3_DIR = process.env.NS3_DIR || "/home/chamod/ns-allinone-3.35/ns-3.35";

// The exact command requested, flattened onto a single line so it does not
// depend on shell line-continuation behaviour.
const SIM_COMMAND =
  "./waf --run 'scratch/auto " +
  "--simTime=300 " +
  '--enable_attackers="{split_path=[12,34,56],interleaved_jamming=[44,55],flow_stretching=[65,76],asymmetric_spoofing=[88,99]}" ' +
  "--split_path_drop_ratio=0.65 " +
  "--ij_drop_ratio=0.75 " +
  "--fs_stretch_ratio=0.85 " +
  "--attack_seed=12345'";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const end = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      send(`cwd: ${NS3_DIR}\n$ ${SIM_COMMAND}\n\n`);

      const child = spawn(SIM_COMMAND, {
        cwd: NS3_DIR,
        shell: true,
        env: process.env,
      });

      child.stdout.on("data", (chunk: Buffer) => send(chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => send(chunk.toString()));

      child.on("error", (err) => {
        send(`\n[failed to start process] ${err.message}\n`);
        end();
      });

      child.on("close", (code, signal) => {
        send(
          signal
            ? `\n[process terminated by signal ${signal}]\n`
            : `\n[process exited with code ${code}]\n`,
        );
        end();
      });

      // Kill the simulation if the client disconnects / aborts the request.
      req.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        send("\n[client aborted — sent SIGTERM]\n");
        end();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
