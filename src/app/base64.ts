const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const decodeTable = new Map([...alphabet].map((character, index) => [character, index]));

export function bytesToBase64(bytes: Uint8Array): string {
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;

    output += alphabet[first >> 2];
    output += alphabet[((first & 0x03) << 4) | (hasSecond ? second >> 4 : 0)];
    output += hasSecond ? alphabet[((second & 0x0f) << 2) | (hasThird ? third >> 6 : 0)] : "=";
    output += hasThird ? alphabet[third & 0x3f] : "=";
  }

  return output;
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, "");
  if (normalized.length % 4 !== 0) {
    throw new Error("Base64 input length must be divisible by 4.");
  }

  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    const first = decodeBase64Character(normalized[index]);
    const second = decodeBase64Character(normalized[index + 1]);
    const third = normalized[index + 2] === "=" ? null : decodeBase64Character(normalized[index + 2]);
    const fourth = normalized[index + 3] === "=" ? null : decodeBase64Character(normalized[index + 3]);

    bytes.push((first << 2) | (second >> 4));
    if (third !== null) {
      bytes.push(((second & 0x0f) << 4) | (third >> 2));
    }
    if (third !== null && fourth !== null) {
      bytes.push(((third & 0x03) << 6) | fourth);
    }
  }

  return new Uint8Array(bytes);
}

function decodeBase64Character(character: string | undefined): number {
  const value = character ? decodeTable.get(character) : undefined;
  if (value === undefined) {
    throw new Error(`Invalid base64 character "${character ?? ""}".`);
  }

  return value;
}
