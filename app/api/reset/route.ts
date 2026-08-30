import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

// Script to run, relative to the server user's home directory.
// Override with the RESET_SCRIPT environment variable.
const RESET_SCRIPT = process.env.RESET_SCRIPT || "~/reset.sh";
// `-n` keeps sudo non-interactive: it fails fast instead of hanging when a
// password is required (there is no TTY here). Configure passwordless sudo for
// this script on the server.
const COMMAND = `sudo -n ${RESET_SCRIPT}`;

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

      const child = spawn(COMMAND, { shell: true, env: process.env });

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
