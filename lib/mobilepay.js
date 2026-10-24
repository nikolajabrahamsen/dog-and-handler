// Thin wrapper around the Vipps MobilePay ePayment API.
// Docs: https://developer.vippsmobilepay.com/docs/APIs/epayment-api/
//
// Flow used here:
//   1. createPayment()  -> get a redirectUrl, send the customer there
//   2. customer approves in the MobilePay app
//   3. MobilePay calls our webhook (api/webhooks/mobilepay.js) with the outcome
//   4. we call getPayment() to double check status before trusting it
//      (never trust the webhook payload alone)

const crypto = require('crypto');

const BASE_URL = process.env.MOBILEPAY_API_BASE_URL?.trim();
const CLIENT_ID = process.env.MOBILEPAY_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.MOBILEPAY_CLIENT_SECRET?.trim();
const SUBSCRIPTION_KEY = process.env.MOBILEPAY_SUBSCRIPTION_KEY?.trim();
const MSN = process.env.MOBILEPAY_MERCHANT_SERIAL_NUMBER?.trim();

// Vercel functions are stateless between cold starts, so this cache only
// helps within a single warm invocation - still worth having.
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 30_000) {
    return cachedToken;
  }
  const res = await fetch(`${BASE_URL}/accesstoken/get`, {
    method: 'POST',
    headers: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'Merchant-Serial-Number': MSN,
    },
  });
  if (!res.ok) {
    throw new Error(`MobilePay auth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

function authHeaders(token, idempotencyKey) {
  return {
    Authorization: `Bearer ${token}`,
    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    'Merchant-Serial-Number': MSN,
    'Vipps-System-Name': 'dog-training-app',
    'Vipps-System-Version': '1.0.0',
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };
}

async function createPayment({ amountDkk, reference, description, returnUrl }) {
  const token = await getAccessToken();
  const body = {
    amount: { currency: 'DKK', value: Math.round(amountDkk * 100) }, // øre
    paymentMethod: { type: 'WALLET' },
    reference,
    returnUrl,
    userFlow: 'WEB_REDIRECT',
    paymentDescription: description,
  };

  const res = await fetch(`${BASE_URL}/epayment/v1/payments`, {
    method: 'POST',
    headers: authHeaders(token, crypto.randomUUID()),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MobilePay createPayment failed: ${res.status} ${await res.text()}`);
  }
  return res.json(); // { reference, redirectUrl }
}

async function getPayment(reference) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/epayment/v1/payments/${reference}`, {
    method: 'GET',
    headers: authHeaders(token, crypto.randomUUID()),
  });
  if (!res.ok) {
    throw new Error(`MobilePay getPayment failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Moves the reserved money to the merchant. Without this a MobilePay payment
// stays "Reserveret" and eventually expires. Deterministic idempotency key,
// so retrying the same capture is safe.
async function capturePayment(reference, amountDkk) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/epayment/v1/payments/${reference}/capture`, {
    method: 'POST',
    headers: authHeaders(token, `capture-${reference}`),
    body: JSON.stringify({ modificationAmount: { currency: 'DKK', value: Math.round(amountDkk * 100) } }),
  });
  if (!res.ok) {
    throw new Error(`MobilePay capture failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Releases a reservation without taking any money (used if the class filled
// up while the customer was paying).
async function cancelPayment(reference) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/epayment/v1/payments/${reference}/cancel`, {
    method: 'POST',
    headers: authHeaders(token, `cancel-${reference}`),
  });
  if (!res.ok) {
    throw new Error(`MobilePay cancel failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

module.exports = { createPayment, getPayment, capturePayment, cancelPayment };
