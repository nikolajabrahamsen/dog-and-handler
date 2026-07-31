const { createClient } = require('@supabase/supabase-js');

// Service role key bypasses Row Level Security - this file must only ever
// run server-side (inside /api functions), never be imported by frontend
// code or have its key exposed to the browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabase };
