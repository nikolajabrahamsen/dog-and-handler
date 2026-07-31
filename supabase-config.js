// These values are safe to expose in the browser - the publishable key
// only carries the same low privileges as the old "anon" key, and access
// is still enforced by Supabase Auth + Row Level Security on the backend.
//
// Fill in your project's values below (Supabase dashboard -> Project
// Settings -> API):
//   - url: the "Project URL"
//   - publishableKey: the "Publishable key" (starts with sb_publishable_...)
//     — NOT the secret key, never put that here.
const SUPABASE_CONFIG = {
  url: 'https://qgokzgkylxfmrnodpemp.supabase.co',
  publishableKey: 'sb_publishable_Gbg2TN9rGkR82CnCYPIXCA_to_ZQ2-R',
};
