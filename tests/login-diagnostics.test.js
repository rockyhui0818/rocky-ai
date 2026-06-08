const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    end(payload = "") {
      this.body = payload;
    }
  };
}

function createJsonRequest(body) {
  return {
    method: "POST",
    headers: {},
    [Symbol.asyncIterator]: async function* iterateBody() {
      yield Buffer.from(JSON.stringify(body));
    }
  };
}

async function postLoginWithRows(rows, body = { username: "admin", password: "admin123" }) {
  clearApiModule("api/_lib/supabase.js");
  clearApiModule("api/auth/login.js");
  const supabaseModule = require(path.join(root, "api/_lib/supabase.js"));
  supabaseModule.supabaseRequest = async () => rows;
  const handler = require(path.join(root, "api/auth/login.js"));
  const res = createMockResponse();
  await handler(createJsonRequest(body), res);
  return {
    statusCode: res.statusCode,
    payload: JSON.parse(res.body)
  };
}

async function run() {
  const missingAccount = await postLoginWithRows([]);
  assert.strictEqual(missingAccount.statusCode, 401);
  assert.strictEqual(missingAccount.payload.error, "INVALID_CREDENTIALS");
  assert.strictEqual(missingAccount.payload.details.reason, "ACCOUNT_NOT_FOUND");

  const wrongPassword = await postLoginWithRows([
    {
      id: "acc_1",
      username: "admin",
      password_hash: "not-the-admin123-hash",
      status: "active"
    }
  ]);
  assert.strictEqual(wrongPassword.statusCode, 401);
  assert.strictEqual(wrongPassword.payload.details.reason, "PASSWORD_HASH_MISMATCH");

  const pausedAccount = await postLoginWithRows([
    {
      id: "acc_1",
      username: "admin",
      password_hash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
      status: "paused"
    }
  ]);
  assert.strictEqual(pausedAccount.statusCode, 401);
  assert.strictEqual(pausedAccount.payload.details.reason, "ACCOUNT_NOT_ACTIVE");
}

run()
  .then(() => console.log("login diagnostics ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
