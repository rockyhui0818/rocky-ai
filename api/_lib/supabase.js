const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
}

async function supabaseRequest(path, options = {}) {
  assertConfigured();
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(options.headers || {})
      }
    });
  } catch (fetchError) {
    const error = new Error(`Supabase network request failed: ${fetchError.message}`);
    error.code = "SUPABASE_NETWORK_FAILED";
    error.details = {
      url_host: (() => {
        try {
          return new URL(SUPABASE_URL).host;
        } catch {
          return "invalid-supabase-url";
        }
      })(),
      cause: fetchError.message
    };
    throw error;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || "Supabase request failed.");
    error.code = "SUPABASE_REQUEST_FAILED";
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function filter(value) {
  return `eq.${encodeURIComponent(value)}`;
}

module.exports = {
  filter,
  supabaseRequest
};
