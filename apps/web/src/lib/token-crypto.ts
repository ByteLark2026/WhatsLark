import { createDecipheriv, scryptSync } from 'crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is not set — required to read WhatsApp channel credentials');
  return scryptSync(secret, 'whatslark-token-salt', 32);
}

/** Mirrors apps/api/src/common/token-crypto.util.ts — must use the same key/salt/format.
 *  Returns the input unchanged if it isn't in encrypted form (rows written before encryption existed). */
export function decryptToken(stored: string | null | undefined): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored;

  const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':');
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
