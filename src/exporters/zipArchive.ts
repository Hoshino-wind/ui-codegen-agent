export interface ZipArchiveFile {
  path: string;
  contents: string;
}

interface ZipEntry {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  localHeaderOffset: number;
}

const textEncoder = new TextEncoder();

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function localFileHeader(entry: ZipEntry): Uint8Array {
  const header = new Uint8Array(30 + entry.name.length);
  writeUInt32LE(header, 0, 0x04034b50);
  writeUInt16LE(header, 4, 20);
  writeUInt16LE(header, 6, 0x0800);
  writeUInt16LE(header, 8, 0);
  writeUInt16LE(header, 10, 0);
  writeUInt16LE(header, 12, 0);
  writeUInt32LE(header, 14, entry.crc);
  writeUInt32LE(header, 18, entry.data.length);
  writeUInt32LE(header, 22, entry.data.length);
  writeUInt16LE(header, 26, entry.name.length);
  writeUInt16LE(header, 28, 0);
  header.set(entry.name, 30);
  return header;
}

function centralDirectoryHeader(entry: ZipEntry): Uint8Array {
  const header = new Uint8Array(46 + entry.name.length);
  writeUInt32LE(header, 0, 0x02014b50);
  writeUInt16LE(header, 4, 20);
  writeUInt16LE(header, 6, 20);
  writeUInt16LE(header, 8, 0x0800);
  writeUInt16LE(header, 10, 0);
  writeUInt16LE(header, 12, 0);
  writeUInt16LE(header, 14, 0);
  writeUInt32LE(header, 16, entry.crc);
  writeUInt32LE(header, 20, entry.data.length);
  writeUInt32LE(header, 24, entry.data.length);
  writeUInt16LE(header, 28, entry.name.length);
  writeUInt16LE(header, 30, 0);
  writeUInt16LE(header, 32, 0);
  writeUInt16LE(header, 34, 0);
  writeUInt16LE(header, 36, 0);
  writeUInt32LE(header, 38, 0);
  writeUInt32LE(header, 42, entry.localHeaderOffset);
  header.set(entry.name, 46);
  return header;
}

function endOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Uint8Array {
  const record = new Uint8Array(22);
  writeUInt32LE(record, 0, 0x06054b50);
  writeUInt16LE(record, 4, 0);
  writeUInt16LE(record, 6, 0);
  writeUInt16LE(record, 8, entryCount);
  writeUInt16LE(record, 10, entryCount);
  writeUInt32LE(record, 12, centralDirectorySize);
  writeUInt32LE(record, 16, centralDirectoryOffset);
  writeUInt16LE(record, 20, 0);
  return record;
}

/**
 * Create a standards-compliant ZIP archive using stored files. The browser
 * project handoff does not need compression; it needs deterministic bytes and
 * real file boundaries so the export can be unzipped into a project folder.
 */
export function createStoredZipArchive(files: ZipArchiveFile[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  for (const file of files) {
    const entry: ZipEntry = {
      name: textEncoder.encode(file.path),
      data: textEncoder.encode(file.contents),
      crc: 0,
      localHeaderOffset: offset
    };
    entry.crc = crc32(entry.data);

    const header = localFileHeader(entry);
    parts.push(header, entry.data);
    entries.push(entry);
    offset += header.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectoryParts = entries.map((entry) => centralDirectoryHeader(entry));
  const centralDirectorySize = centralDirectoryParts.reduce((sum, part) => sum + part.length, 0);

  parts.push(...centralDirectoryParts);
  parts.push(endOfCentralDirectory(entries.length, centralDirectorySize, centralDirectoryOffset));

  return concat(parts);
}
