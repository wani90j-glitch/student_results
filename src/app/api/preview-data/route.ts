/** Made-up data for the preview page. Exists only when ITQAN_PREVIEW=1 (never set in production). */
import fs from "node:fs";
import { notFound } from "next/navigation";

export async function GET() {
  if (process.env.ITQAN_PREVIEW !== "1" || !process.env.ITQAN_PREVIEW_FIXTURE) notFound();
  return new Response(fs.readFileSync(process.env.ITQAN_PREVIEW_FIXTURE, "utf8"), { headers: { "content-type": "application/json" } });
}
