const { supabase } = require('./supabase');

// Verifies the Supabase Auth session token sent by the admin frontend
// (Authorization: Bearer <access_token>). Returns the authenticated user,
// or null if the token is missing/invalid, or not on the ADMIN_EMAILS
// allow-list (if that's configured).
async function requireAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const allowList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length > 0 && !allowList.includes((data.user.email || '').toLowerCase())) {
    return null;
  }

  return data.user;
}

function requestBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
}

module.exports = { requireAdmin, requestBaseUrl };
