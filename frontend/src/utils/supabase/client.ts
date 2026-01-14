import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Missing Supabase environment variables! Re-render may fail.')
    // Return a dummy client or throw a more descriptive error
    // In many Next.js setups, throwing here during SSR will show a digest error
  }

  return createBrowserClient(
    url || '',
    key || ''
  )
}
