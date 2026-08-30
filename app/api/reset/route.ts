import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

// Home directory the scripts expect (their paths live under here, e.g.
// ~/fabric/...). Override with RESET_HOME.
const RESET_HOME = process.env.RESET_HOME || "/home/chamod";
// Password piped on stdin so any `sudo -S` calls *inside* a script can read it.
// The scripts themselves are run as the current (non-root) user. Override with
// SUDO_PASSWORD.
const SUDO_PASSWORD = process.env.SUDO_PASSWORD ?? "11111";

// Allow-listed targets → script paths. A leading "~" is expanded against RESET_HOME.
const SCRIPTS = {
  lightweight: process.env.RESET_SCRIPT || "~/reset.sh",
  drl: process.env.RESET_DRL_SCRIPT || "~/reset_drl",
} as const;
type Target = keyof typeof SCRIPTS;

const expandHome = (p: string) => p.replace(/^~(?=\/|$)/, RESET_HOME);

function buildCommand(target: Target): string {
  // Run as the current user — no sudo wrapper, nothing runs as root here.
  return `bash '${expandHome(SCRIPTS[target])}'`;
}

export async function POST(req: NextRequest) {
  let target: Target = "lightweight";
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await req.json()) as { target?: string };
      if (body?.target != null) {
        if (!(body.target in SCRIPTS)) {
          return new Response(`Unknown reset target: ${body.target}\n`, {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        target = body.target as Target;
      }
    } catch {
      return new Response("Invalid JSON body\n", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const command = buildCommand(target);
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

      send(`$ ${command}\n\n`);

      const child = spawn(command, {
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
