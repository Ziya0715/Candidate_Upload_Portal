import 'server-only';

// Used when the host does not provide environment variables.
const DEFAULT_USERNAME = 'taizotechnologies@gmail.com';
const DEFAULT_PASSWORD = 'Taizo@123';
const DEFAULT_SESSION_SECRET = 'f0bffa1c16e18a19f26436b08421bfac5d721e028396b4be5c5edcbe833bb761';
const DEFAULT_SPACES_KEY = 'DO80184VLVEUL3AJZ3G4';
const DEFAULT_SPACES_SECRET = '1BzKrOgdbRQ7m6hvtnY4MmKl5VFRNVmmYovHVhJYrg8';
const DEFAULT_SPACES_BUCKET = 'taizo-courze1on1-bucket';
const DEFAULT_SPACES_REGION = 'sgp1';
const DEFAULT_SPACES_ENDPOINT = 'https://sgp1.digitaloceanspaces.com';

export function staffUsername() {
  return (process.env.STAFF_USERNAME || DEFAULT_USERNAME).trim();
}

export function staffPassword() {
  return (process.env.STAFF_PASSWORD || DEFAULT_PASSWORD).trim();
}

export function spacesSettings() {
  return {
    bucket: (process.env.DO_SPACES_BUCKET || DEFAULT_SPACES_BUCKET).trim(),
    region: (process.env.DO_SPACES_REGION || DEFAULT_SPACES_REGION).trim(),
    endpoint: (process.env.DO_SPACES_ENDPOINT || DEFAULT_SPACES_ENDPOINT).trim().replace(/\/+$/, ''),
    accessKeyId: (process.env.DO_SPACES_KEY || DEFAULT_SPACES_KEY).trim(),
    secretAccessKey: (process.env.DO_SPACES_SECRET || DEFAULT_SPACES_SECRET).trim(),
  };
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
