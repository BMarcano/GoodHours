import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// flowType is pinned to 'implicit' (the current library default) on purpose:
// password-reset / auth links carry their tokens in the URL hash and work on
// ANY device or browser. The alternative ('pkce') stores a verifier in the
// browser that REQUESTED the link, so opening the email on a different device
// would silently fail. Pinning protects us if a future library version flips
// the default.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
