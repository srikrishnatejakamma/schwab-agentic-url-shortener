import crypto from 'node:crypto';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateBase62Code(length = 7): string {
  let output = '';

  while (output.length < length) {
    const byte = crypto.randomBytes(1)[0];
    output += alphabet[byte % alphabet.length];
  }

  return output;
}