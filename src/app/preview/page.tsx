import { notFound } from "next/navigation";
import Preview from "./Preview";

/** The real interface on made-up data, for automated screen checks. Off unless ITQAN_PREVIEW=1. */
export default function Page() {
  if (process.env.ITQAN_PREVIEW !== "1") notFound();
  return <Preview />;
}
