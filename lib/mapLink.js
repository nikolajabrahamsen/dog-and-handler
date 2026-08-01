// Emails can't reliably run JS or know what device they'll be opened on
// later, so there's no equivalent of the browser's platform detection
// (see locationHref in app.js) here. Falls back to a Google Maps link,
// which works acceptably as a single link on both Android and iOS.
function buildEmailMapUrl(cls) {
  if (cls.location_url) return cls.location_url;
  if (!cls.location) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cls.location)}`;
}

module.exports = { buildEmailMapUrl };
