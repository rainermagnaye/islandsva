const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID: dal functions check ids first, so a malformed one returns null, not a database error. */
export function isUuid(value: string) {
  return UUID.test(value);
}
