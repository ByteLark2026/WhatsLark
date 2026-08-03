import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is not set — required to store/read WhatsApp channel credentials');
  return scryptSync(secret, 'whatslark-token-salt', 32);
}

/** AES-256-GCM encrypt. Returns `enc:v1:<iv>:<authTag>:<ciphertext>` (all hex). */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Decrypts a value produced by encryptToken. Returns the input unchanged if it isn't in encrypted form
 *  (backward compatible with rows written before encryption was added — see migration 020). */
export function decryptToken(stored: string | null | undefined): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored;

  const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':');
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
