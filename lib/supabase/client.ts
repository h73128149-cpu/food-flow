
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "تنظیمات Supabase کامل نیست. NEXT_PUBLIC_SUPABASE_URL و یکی از NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY یا NEXT_PUBLIC_SUPABASE_ANON_KEY را در تنظیمات محیطی وارد کنید."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
