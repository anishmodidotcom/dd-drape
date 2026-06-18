// Feature flags. Video (i2v) is OFF by default until the final-pass rebuild verifies the pipeline
// end to end. The audit found the three video definitions disagreed (registry slug vs route field
// vs worker slug); they are now aligned on ONE model (see below), but the path is still unverified
// live (no worker run / webhook capture), so we keep it behind a flag and fail cleanly when off.
//
// INTENDED VIDEO WIRING (the final-pass rebuild must keep all three in agreement):
//   model:  fal-ai/kling-video/v3/pro/image-to-video   (registry video/standard slug)
//   field:  start_image_url  (the approved still as the first frame)
//   worker: submits the SAME slug with the SAME field; the fal webhook settles.
// To enable: set DRAPE_VIDEO_ENABLED=true on the Next app AND run the Railway worker.

export function videoEnabled(): boolean {
  return process.env.DRAPE_VIDEO_ENABLED === "true";
}
