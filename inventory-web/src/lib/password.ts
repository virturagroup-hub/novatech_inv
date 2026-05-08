const TEMP_PASSWORD_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*";

export function generateTemporaryPassword(length = 16) {
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);

  return Array.from(values, (value) => TEMP_PASSWORD_CHARACTERS[value % TEMP_PASSWORD_CHARACTERS.length]).join(
    "",
  );
}
