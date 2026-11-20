import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    // Validate mime type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, WEBP, or AVIF image." },
        { status: 400 }
      );
    }

    // Limit size to 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image file too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || ".jpg";
    const cleanBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const fileName = `dish_${Date.now()}_${cleanBase}${ext}`;

    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      // Upload to Supabase Storage bucket 'menu-dishes'
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from("menu-dishes")
        .upload(fileName, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabaseAdmin.storage
          .from("menu-dishes")
          .getPublicUrl(fileName);

        if (pubData?.publicUrl) {
          return NextResponse.json({ url: pubData.publicUrl });
        }
      } else if (uploadErr) {
        console.warn("[KORA Storage] Supabase upload warning:", uploadErr.message);
      }
    }

    // Fallback: Save to local public/uploads directory (e.g. dev environment)
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "dishes");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFilePath = path.join(uploadDir, fileName);
      fs.writeFileSync(localFilePath, buffer);
      return NextResponse.json({ url: `/uploads/dishes/${fileName}` });
    } catch {
      // In serverless environment without storage bucket or write access, convert to data URI
      const base64 = buffer.toString("base64");
      const dataUri = `data:${file.type || "image/jpeg"};base64,${base64}`;
      return NextResponse.json({ url: dataUri });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      { status: 500 }
    );
  }
}
