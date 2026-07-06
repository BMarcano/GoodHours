import { createClient } from '@supabase/supabase-js'

// Not imported anywhere yet - gets wired in when we replace the mock
// auth/paywall with Supabase Auth (magic link) + real subscriptions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
