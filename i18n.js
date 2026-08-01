// Simple client-side i18n. Danish is the default; the person's choice
// (once they toggle) is remembered in localStorage per browser.
//
// Usage:
//   t('some_key')                        -> translated string
//   t('spots_left', { n: 3 })             -> handles {n} placeholders
//   applyStaticTranslations()             -> fills every [data-i18n] element
//   window.addEventListener('langchange', fn)  -> re-render dynamic content

const TRANSLATIONS = {
  da: {
    page_title: 'Hund & Handler',
    tagline: 'Nye hold hver måned',
    hero_intro: 'Vælg et hold, tilmeld din hund, og betal sikkert med MobilePay eller ved fremmøde. Din plads er bekræftet, så snart betalingen er på plads.',
    classes_heading: 'Månedens hold',
    loading_classes: 'Indlæser hold…',
    no_classes: 'Der er ingen åbne hold lige nu — kig forbi igen snart.',
    load_error: 'Kunne ikke indlæse hold lige nu. Prøv igen om lidt.',
    starts_label: 'Start',
    spots_left_one: '{n} plads tilbage',
    spots_left_other: '{n} pladser tilbage',
    class_full_label: 'Holdet er fyldt',
    register_btn: 'Tilmeld',
    registration_closed_btn: 'Tilmelding lukket',

    modal_price_spots_one: '{price} · {n} plads tilbage',
    modal_price_spots_other: '{price} · {n} pladser tilbage',
    field_owner_name: 'Dit navn',
    field_dog_name: 'Hundens navn',
    field_email: 'E-mail',
    field_phone: 'Telefon',
    phone_note_mobilepay: 'Bruges til at forbinde din MobilePay-betaling og til at kontakte dig, hvis nødvendigt.',
    phone_note_pay_at_class: 'I tilfælde af at vi skal kontakte dig om holdet.',
    newsletter_label: 'Send mig nyheder og opdateringer om kommende hold på e-mail',
    payment_legend: 'Hvordan vil du betale?',
    pay_mobilepay_label: 'Betal nu med MobilePay',
    pay_at_class_label: 'Betal ved fremmøde',
    pay_note_mobilepay: 'Du bliver sendt til MobilePay for at godkende betalingen. Din plads er først bekræftet, når betalingen er gennemført.',
    pay_note_pay_at_class: 'Din plads bekræftes med det samme. Medbring betaling til dit første hold.',
    cancel_btn: 'Annullér',
    register_submit_btn: 'Tilmeld',
    confirm_submit_btn: 'Bekræft tilmelding',
    starting_payment_btn: 'Starter betaling…',
    confirming_btn: 'Bekræfter…',

    err_class_not_found: 'Holdet blev ikke fundet',
    err_class_closed: 'Tilmelding til dette hold er lukket',
    err_class_full: 'Holdet blev lige fyldt op',
    err_mobilepay_failed: 'Kunne ikke starte MobilePay-betaling. Prøv venligst igen.',
    err_generic: 'Noget gik galt. Prøv venligst igen.',

    // payment-return.html
    confirming_title: 'Bekræfter din betaling…',
    confirming_body: 'Et øjeblik, det tager ikke lang tid.',
    confirmed_title: 'Du er tilmeldt!',
    confirmed_body_mobilepay: 'Din plads er bekræftet, og vi har sendt en bekræftelse til din e-mail.',
    confirmed_body_pay_at_class: 'Din plads er bekræftet. Medbring venligst betaling til dit første hold.',
    failed_title: 'Betaling ikke gennemført',
    failed_body: 'Din tilmelding blev ikke bekræftet. Der er ikke trukket nogen betaling — prøv gerne igen.',
    still_confirming_title: 'Stadig i gang…',
    still_confirming_body: 'Det tager lidt længere end normalt. Vi sender dig en e-mail, så snart det er bekræftet.',
    not_found_title: 'Vi kunne ikke finde tilmeldingen',
    not_found_body: 'Gå venligst tilbage, og prøv at tilmelde dig igen.',
    generic_error_title: 'Noget gik galt',
    generic_error_body: 'Tjek venligst din e-mail om lidt, eller kontakt os, hvis du er i tvivl.',
    back_to_home_btn: 'Tilbage til forsiden',

    // admin / login
    admin_title: 'Admin',
    login_title: 'Admin-login',
    login_sub: 'Log ind for at administrere Hund & Handlers hold.',
    email_label: 'E-mail',
    password_label: 'Adgangskode',
    sign_in_btn: 'Log ind',
    signing_in_btn: 'Logger ind…',
    login_error: 'Forkert e-mail eller adgangskode.',
    forgot_password_link: 'Glemt adgangskode?',
    forgot_password_title: 'Nulstil adgangskode',
    forgot_password_sub: 'Indtast din e-mail, så sender vi dig et link til at vælge en ny adgangskode.',
    send_reset_link_btn: 'Send link',
    reset_link_sent_msg: 'Hvis der findes en konto med den e-mail, har vi sendt et link til at nulstille adgangskoden.',
    back_to_login_btn: 'Tilbage til login',
    change_password_heading: 'Skift adgangskode',
    new_password_label: 'Ny adgangskode',
    confirm_new_password_label: 'Bekræft ny adgangskode',
    change_password_btn: 'Skift adgangskode',
    password_changed_msg: 'Adgangskode skiftet ✓',
    logout_btn: 'Log ud',
    checking_invite: 'Tjekker invitationen…',
    set_password_title: 'Vælg en adgangskode',
    set_password_sub: 'Vælg en adgangskode for at få adgang til admin-panelet.',
    confirm_password_label: 'Bekræft adgangskode',
    set_password_btn: 'Gem adgangskode',
    saving_btn: 'Gemmer…',
    passwords_dont_match: 'Adgangskoderne er ikke ens.',
    invite_invalid_title: 'Linket virker ikke',
    invite_invalid_body: 'Dette invitationslink er ugyldigt eller udløbet. Bed om en ny invitation.',
    create_class_heading: 'Opret hold',
    title_label: 'Titel',
    description_label: 'Beskrivelse',
    start_datetime_label: 'Startdato og -tid',
    end_datetime_label: 'Slutdato (valgfrit)',
    release_datetime_label: 'Frigivelsesdato (valgfrit)',
    announce_before_release_label: 'Send nyhedsbrev 10 min. før frigivelse',
    not_released_yet_label: 'Frigives {date}',
    weekday_label: 'Ugedag (valgfrit)',
    location_label: 'Sted',
    max_participants_label: 'Maks. deltagere',
    price_label: 'Pris (DKK)',
    create_class_btn: 'Opret hold',
    class_created_msg: 'Hold oprettet ✓',
    edit_class_heading: 'Redigér hold',
    edit_class_btn: 'Redigér',
    save_changes_btn: 'Gem ændringer',
    cancel_edit_btn: 'Annullér redigering',
    class_updated_msg: 'Hold opdateret ✓',
    delete_class_btn: 'Slet',
    confirm_delete_class: 'Er du sikker på, at du vil slette "{title}"? Alle tilmeldinger til dette hold slettes også permanent. Dette kan ikke fortrydes.',
    newsletter_heading: 'Nyhedsbrev',
    loading_subscriber_count: 'Indlæser antal tilmeldte…',
    subscriber_count_msg: '{n} tilmeldt til nyheder på e-mail.',
    subject_label: 'Emne',
    message_label: 'Besked',
    send_newsletter_btn: 'Send til abonnenter',
    sending_btn: 'Sender…',
    classes_rosters_heading: 'Hold & tilmeldte',
    loading_msg: 'Indlæser…',
    no_classes_yet: 'Ingen hold endnu.',
    close_manually_btn: 'Luk manuelt',
    reopen_btn: 'Genåbn',
    view_roster_btn: 'Se tilmeldte',
    add_participant_btn: 'Tilføj deltager',
    add_participant_heading: 'Tilføj deltager uden betaling',
    move_btn: 'Flyt',
    move_registration_heading: 'Flyt til andet hold',
    select_class_label: 'Vælg hold',
    payment_manual: 'Tilføjet af admin',
    copy_class_btn: 'Kopiér',
    old_classes_heading: 'Gamle hold (seneste 10)',
    loading_roster: 'Indlæser tilmeldte…',
    no_registrations_yet: 'Ingen tilmeldinger endnu.',
    confirmed_label: 'bekræftet',
    paid_count_label: '{n} betalt',
    pay_at_class_count_label: '{n} betaler ved fremmøde',
    reserved_count_label: '{n} reserveret',
    empty_count_label: '{n} ledige',
    total_label: 'i alt',
    open_label: 'åben',
    closed_label: 'lukket',
    col_owner: 'Ejer',
    col_dog: 'Hund',
    col_email: 'E-mail',
    col_phone: 'Telefon',
    col_payment: 'Betaling',
    col_status: 'Status',
    payment_at_class: 'Ved fremmøde',
    payment_mobilepay: 'MobilePay',
    delete_registration_btn: 'Slet tilmelding',
    confirm_delete_registration: 'Er du sikker på, at du vil slette denne tilmelding? Dette kan ikke fortrydes.',
  },

  en: {
    page_title: 'Hund & Handler',
    tagline: 'New classes every month',
    hero_intro: 'Pick a class, register your dog, and pay securely with MobilePay or at class. Your spot is confirmed the moment payment is settled.',
    classes_heading: "This month's classes",
    loading_classes: 'Loading classes…',
    no_classes: "No classes are open yet — check back soon.",
    load_error: "Couldn't load classes right now. Try again shortly.",
    starts_label: 'Starts',
    spots_left_one: '{n} spot left',
    spots_left_other: '{n} spots left',
    class_full_label: 'Class is full',
    register_btn: 'Register',
    registration_closed_btn: 'Registration closed',

    modal_price_spots_one: '{price} · {n} spot left',
    modal_price_spots_other: '{price} · {n} spots left',
    field_owner_name: 'Your name',
    field_dog_name: "Dog's name",
    field_email: 'Email',
    field_phone: 'Phone',
    phone_note_mobilepay: 'Used to link your MobilePay payment and reach you if needed.',
    phone_note_pay_at_class: 'In case we need to reach you about your class.',
    newsletter_label: 'Send me news and updates about upcoming classes by email',
    payment_legend: 'How will you pay?',
    pay_mobilepay_label: 'Pay now with MobilePay',
    pay_at_class_label: 'Pay at class',
    pay_note_mobilepay: "You'll be taken to MobilePay to approve the payment. Your spot is only confirmed once the payment goes through.",
    pay_note_pay_at_class: "Your spot is confirmed right away. Bring payment with you to your first class.",
    cancel_btn: 'Cancel',
    register_submit_btn: 'Register',
    confirm_submit_btn: 'Confirm registration',
    starting_payment_btn: 'Starting payment…',
    confirming_btn: 'Confirming…',

    err_class_not_found: 'Class not found',
    err_class_closed: 'Registration for this class is closed',
    err_class_full: 'This class just filled up',
    err_mobilepay_failed: 'Could not start MobilePay payment. Please try again.',
    err_generic: 'Something went wrong. Please try again.',

    confirming_title: 'Confirming your payment…',
    confirming_body: 'Hang tight, this only takes a moment.',
    confirmed_title: "You're in!",
    confirmed_body_mobilepay: "Your spot is confirmed and we've sent a confirmation to your email.",
    confirmed_body_pay_at_class: 'Your spot is confirmed. Please bring payment with you to your first class.',
    failed_title: 'Payment not completed',
    failed_body: 'Your registration was not confirmed. No payment was taken — feel free to try again.',
    still_confirming_title: 'Still confirming…',
    still_confirming_body: "This is taking longer than usual. We'll email you as soon as it's confirmed.",
    not_found_title: "We couldn't find that registration",
    not_found_body: 'Please go back and try registering again.',
    generic_error_title: 'Something went wrong',
    generic_error_body: "Please check your email shortly, or contact us if you're unsure.",
    back_to_home_btn: 'Back to homepage',

    admin_title: 'Admin',
    login_title: 'Admin login',
    login_sub: 'Sign in to manage Hund & Handler classes.',
    email_label: 'Email',
    password_label: 'Password',
    sign_in_btn: 'Sign in',
    signing_in_btn: 'Signing in…',
    login_error: 'Incorrect email or password.',
    forgot_password_link: 'Forgot password?',
    forgot_password_title: 'Reset password',
    forgot_password_sub: "Enter your email and we'll send you a link to choose a new password.",
    send_reset_link_btn: 'Send link',
    reset_link_sent_msg: "If an account exists with that email, we've sent a password reset link.",
    back_to_login_btn: 'Back to login',
    change_password_heading: 'Change password',
    new_password_label: 'New password',
    confirm_new_password_label: 'Confirm new password',
    change_password_btn: 'Change password',
    password_changed_msg: 'Password changed ✓',
    logout_btn: 'Log out',
    checking_invite: 'Checking your invite…',
    set_password_title: 'Choose a password',
    set_password_sub: 'Choose a password to access the admin panel.',
    confirm_password_label: 'Confirm password',
    set_password_btn: 'Save password',
    saving_btn: 'Saving…',
    passwords_dont_match: "Passwords don't match.",
    invite_invalid_title: "This link isn't working",
    invite_invalid_body: 'This invite link is invalid or has expired. Ask for a new invite.',
    create_class_heading: 'Create a class',
    title_label: 'Title',
    description_label: 'Description',
    start_datetime_label: 'Start date & time',
    end_datetime_label: 'End date (optional)',
    release_datetime_label: 'Release date (optional)',
    announce_before_release_label: 'Send newsletter 10 min before release',
    not_released_yet_label: 'Releases {date}',
    weekday_label: 'Weekday label (optional)',
    location_label: 'Location',
    max_participants_label: 'Max participants',
    price_label: 'Price (DKK)',
    create_class_btn: 'Create class',
    class_created_msg: 'Class created ✓',
    edit_class_heading: 'Edit class',
    edit_class_btn: 'Edit',
    save_changes_btn: 'Save changes',
    cancel_edit_btn: 'Cancel edit',
    class_updated_msg: 'Class updated ✓',
    delete_class_btn: 'Delete',
    confirm_delete_class: 'Are you sure you want to delete "{title}"? All registrations for this class will also be permanently deleted. This cannot be undone.',
    newsletter_heading: 'Newsletter',
    loading_subscriber_count: 'Loading subscriber count…',
    subscriber_count_msg: '{n} subscriber(s) opted in to news emails.',
    subject_label: 'Subject',
    message_label: 'Message',
    send_newsletter_btn: 'Send to subscribers',
    sending_btn: 'Sending…',
    classes_rosters_heading: 'Classes & rosters',
    loading_msg: 'Loading…',
    no_classes_yet: 'No classes yet.',
    close_manually_btn: 'Close manually',
    reopen_btn: 'Reopen',
    view_roster_btn: 'View roster',
    add_participant_btn: 'Add participant',
    add_participant_heading: 'Add participant without payment',
    move_btn: 'Move',
    move_registration_heading: 'Move to a different class',
    select_class_label: 'Select class',
    payment_manual: 'Added by admin',
    copy_class_btn: 'Copy',
    old_classes_heading: 'Old classes (last 10)',
    loading_roster: 'Loading roster…',
    no_registrations_yet: 'No registrations yet.',
    confirmed_label: 'confirmed',
    paid_count_label: '{n} paid',
    pay_at_class_count_label: '{n} pay at class',
    reserved_count_label: '{n} reserved',
    empty_count_label: '{n} empty',
    total_label: 'total',
    open_label: 'open',
    closed_label: 'closed',
    col_owner: 'Owner',
    col_dog: 'Dog',
    col_email: 'Email',
    col_phone: 'Phone',
    col_payment: 'Payment',
    col_status: 'Status',
    payment_at_class: 'At class',
    payment_mobilepay: 'MobilePay',
    delete_registration_btn: 'Delete registration',
    confirm_delete_registration: 'Are you sure you want to delete this registration? This cannot be undone.',
  },
};

function getLang() {
  return localStorage.getItem('lang') || 'da';
}

function t(key, vars) {
  const lang = getLang();
  let str = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.da[key] || key;
  if (vars) {
    for (const k in vars) str = str.replace(`{${k}}`, vars[k]);
  }
  return str;
}

// Danish/English pluralization is both just singular-vs-not, so this
// simple helper covers every plural string used in this app.
function tPlural(baseKey, n, vars = {}) {
  const key = n === 1 ? `${baseKey}_one` : `${baseKey}_other`;
  return t(key, { n, ...vars });
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === getLang());
  });
  document.documentElement.lang = getLang();
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
  applyStaticTranslations();
  window.dispatchEvent(new CustomEvent('langchange'));
}

// Inserts a small DA / EN toggle into any element with id="langSwitcher".
function renderLangSwitcher() {
  const host = document.getElementById('langSwitcher');
  if (!host) return;
  host.innerHTML = `
    <button type="button" data-lang-btn="da">DA</button>
    <button type="button" data-lang-btn="en">EN</button>
  `;
  host.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang-btn')));
  });
  applyStaticTranslations();
}

document.addEventListener('DOMContentLoaded', () => {
  renderLangSwitcher();
  applyStaticTranslations();
});
