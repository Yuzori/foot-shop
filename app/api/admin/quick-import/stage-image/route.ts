import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { saveStagedQuickImportImage } from "@/lib/quick-import/staged-images";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Reçoit une image compressée avant l'envoi PrestaShop (évite les gros POST). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "file_required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength < 2_500) {
      return NextResponse.json({ message: "image_too_small" }, { status: 400 });
    }
    if (buffer.byteLength > 20 * 1024 * 1024) {
      return NextResponse.json({ message: "image_too_large" }, { status: 413 });
    }

    const imageId = await saveStagedQuickImportImage(
      buffer,
      file.type || "image/jpeg",
    );

    return NextResponse.json({ ok: true, imageId });
  } catch (err) {
    console.error("[quick-import/stage-image]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "stage_failed" },
      { status: 500 },
    );
  }
}
