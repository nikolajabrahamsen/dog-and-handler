function isAdmin(req) {
  return req.headers['x-admin-key'] === process.env.ADMIN_KEY;
}

function requestBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
}

module.exports = { isAdmin, requestBaseUrl };
