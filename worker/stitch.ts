// ffmpeg clip stitching for longer video sequences. Models drift after ~10s, so we generate
// short clips (5-8s) and concatenate them here in the worker (Vercel cannot run ffmpeg).
//
// Used when a video job's payload carries multiple clip URLs (a multi-shot sequence). The single
// clip path does not need this. Railway provisions ffmpeg via nixpacks.toml.

import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function run(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/**
 * Concatenate ordered clip URLs into a single MP4. Returns the bytes of the stitched output.
 * Re-encodes with a uniform codec so clips from different generations join cleanly.
 */
export async function stitchClips(clipUrls: string[]): Promise<Buffer> {
  if (clipUrls.length === 0) throw new Error("no clips to stitch");
  const dir = await mkdtemp(join(tmpdir(), "drape-stitch-"));
  try {
    const files: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      const f = join(dir, `clip${i}.mp4`);
      await download(clipUrls[i], f);
      files.push(f);
    }
    const listPath = join(dir, "list.txt");
    await writeFile(listPath, files.map((f) => `file '${f}'`).join("\n"));

    const outPath = join(dir, "out.mp4");
    await run("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c:v", "libx264",
      "-c:a", "aac",
      "-pix_fmt", "yuv420p",
      outPath,
    ]);

    const { readFile } = await import("node:fs/promises");
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
