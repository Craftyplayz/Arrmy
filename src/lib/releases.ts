// Release title rules. No I/O here, so they can be unit-tested.

/** Titles that advertise more than one audio language. Radarr and Sonarr run it case-insensitive (.NET regex). */
export const MULTI_AUDIO = String.raw`\bmulti(?![ ._-]?subs?\b)(\b|\d)|\bdual[ ._-]?audio\b`
