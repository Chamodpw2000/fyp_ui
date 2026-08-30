import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

// Home directory whose environment the script expects (its paths live under
// here, e.g. ~/fabric/...). Override with RESET_HOME.
const RESET_HOME = process.env.RESET_HOME || "/home/chamod";
// Script to run. A leading "~" is expanded against RESET_HOME. Override with RESET_SCRIPT.
const RESET_SCRIPT = (process.env.RESET_SCRIPT || "~/reset.sh").replace(/^~(?=\/|$)/, RESET_HOME);
// Sudo password, fed to `sudo -S` on stdin. Override with SUDO_PASSWORD.
const SUDO_PASSWORD = process.env.SUDO_PASSWORD ?? "11111";
const CHILD_PATH =
  process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
// `sudo` normally wipes the environment, so the script sees HOME=/root and a
// trimmed PATH — unlike an interactive `sudo ~/reset.sh`. Force HOME/PATH back
// with `env` so it behaves the same as running it by hand.
// `-S` reads the password from stdin; `-p ''` suppresses the prompt text.
const COMMAND = `sudo -S -p '' env HOME='${RESET_HOME}' PATH='${CHILD_PATH}' bash '${RESET_SCRIPT}'`;

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

      send(`$ ${COMMAND}\n\n`);

      const child = spawn(COMMAND, {
        shell: true,
        cwd: RESET_HOME,
        env: { ...process.env, HOME: RESET_HOME },
      });

      // Supply the sudo password on stdin, then close it.
      child.stdin.on("error", () => {});
      child.stdin.write(`${SUDO_PASSWORD}\n`);
      child.stdin.end();

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
