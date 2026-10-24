import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ok = () => NextResponse.json({ status: "ok" });
const degraded = () => NextResponse.json({ status: "degraded" }, { status: 503 });

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return degraded();

  try {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    return error ? degraded() : ok();
  } catch {
    return degraded();
  }
}
