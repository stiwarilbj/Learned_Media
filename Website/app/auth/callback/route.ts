import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = new URL("/", url.origin);
  if (!code) return NextResponse.redirect(redirectTo);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/?auth=not-configured", url.origin));
  await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(redirectTo);
}
