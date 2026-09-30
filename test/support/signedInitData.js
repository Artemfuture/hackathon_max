import crypto from 'node:crypto';

export const TEST_TOKEN = '12345:test-token';

export function signedInitData(fields, token = TEST_TOKEN) {
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const hash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
