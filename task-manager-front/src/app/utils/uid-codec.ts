// Compact a 128-bit UUID into a 22-char Base64URL code and back.
// No secrecy, just reversible re-encoding.

// URL-safe base64 helpers
function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa works with 8-bit binary strings
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  // Restore padding to multiple of 4
  const mod = s.length % 4;
  const pad =
    mod === 2
      ? "=="
      : mod === 3
      ? "="
      : mod === 0
      ? ""
      : (() => {
          throw new Error("Invalid base64url length");
        })();
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// UUID ⇄ bytes
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("Invalid UUID");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++)
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error("Invalid length");
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20
  )}-${h.slice(20)}`;
}

// Public API
export function uuidToShort(uuid: string): string {
  return b64urlEncode(uuidToBytes(uuid));
}

export function shortToUuid(code: string): string {
  const bytes = b64urlDecode(code);
  if (bytes.length !== 16) throw new Error("Invalid short code length");
  return bytesToUuid(bytes);
}

// Validators
export const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const isShort = (s: string) => /^[A-Za-z0-9\-_]{20,24}$/.test(s);
