// The texts the admin may edit. Anything else is rejected by /api/texts.
const FRONT_KEYS = [
  'tagline', 'hero_intro', 'classes_heading',        // front page
  'nl_signup_heading', 'nl_signup_text', 'nl_signup_note', // newsletter box
  'inapp_title', 'inapp_text', 'inapp_ios', 'inapp_android', // Facebook notice
];
const TERMS_KEYS = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `terms_${n}`);
const EMAIL_KEYS = ['email_closing', 'email_extra']; // confirmation email (Danish only)

const MAX_LENGTH = 5000;

function isAllowed(key, lang) {
  if (lang !== 'da' && lang !== 'en') return false;
  if (EMAIL_KEYS.includes(key)) return lang === 'da';
  return FRONT_KEYS.includes(key) || TERMS_KEYS.includes(key);
}

module.exports = { FRONT_KEYS, TERMS_KEYS, EMAIL_KEYS, MAX_LENGTH, isAllowed };
