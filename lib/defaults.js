import 'server-only';

// Used when the host does not provide environment variables.
const DEFAULT_USERNAME = 'taizotechnologies@gmail.com';
const DEFAULT_PASSWORD = 'Taizo@123';
const DEFAULT_SESSION_SECRET = 'f0bffa1c16e18a19f26436b08421bfac5d721e028396b4be5c5edcbe833bb761';

export function staffUsername() {
  return (process.env.STAFF_USERNAME || DEFAULT_USERNAME).trim();
}

export function staffPassword() {
  return (process.env.STAFF_PASSWORD || DEFAULT_PASSWORD).trim();
}

export function sessionSecretValue() {
  const secret = (process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET).trim();
  if (secret.length < 32 || secret.includes('replace-with')) {
    const error = new Error('Set SESSION_SECRET to a random string of at least 32 characters.');
    error.status = 500;
    error.publicMessage = error.message;
    throw error;
  }
  return secret;
}
