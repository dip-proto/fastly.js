// Strict standard base64 decoding matching Go's base64.StdEncoding:
// CR/LF are ignored, anything else outside the alphabet, bad padding, or a
// bad length is an error (Fastly sets fastly.error=EINVAL and returns "").
function base64ToBuffer(base64: string): Uint8Array | null {
	const cleaned = base64.replace(/[\r\n]/g, "");
	if (cleaned.length % 4 !== 0 || !/^[A-Za-z0-9+/]*(={1,2})?$/.test(cleaned)) {
		return null;
	}
	const unpadded = cleaned.replace(/=+$/, "");
	if (cleaned.length > 0 && unpadded.length % 4 === 1) {
		return null;
	}
	try {
		const binaryString = atob(cleaned);
		const buffer = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			buffer[i] = binaryString.charCodeAt(i);
		}
		return buffer;
	} catch {
		return null;
	}
}

// Strict hex decoding matching Go's hex.DecodeString: case-insensitive, but
// odd length or non-hex characters are an error.
function hexToBuffer(hex: string): Uint8Array | null {
	if (hex.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/.test(hex)) {
		return null;
	}
	const buffer = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		buffer[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return buffer;
}

function utf8ToBuffer(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function asciiToBuffer(text: string): Uint8Array | null {
	const buffer = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i);
		if (charCode > 127) {
			return null;
		}
		buffer[i] = charCode;
	}
	return buffer;
}

function bufferToBase64(buffer: Uint8Array): string {
	let binaryString = "";
	for (let i = 0; i < buffer.length; i++) {
		binaryString += String.fromCharCode(buffer[i]!);
	}
	return btoa(binaryString);
}

// Fastly's bin.base64_to_hex returns uppercase hex.
function bufferToHex(buffer: Uint8Array): string {
	let hexString = "";
	for (let i = 0; i < buffer.length; i++) {
		hexString += buffer[i]!.toString(16).padStart(2, "0").toUpperCase();
	}
	return hexString;
}

function bufferToUtf8(buffer: Uint8Array): string {
	return new TextDecoder("utf-8").decode(buffer);
}

function bufferToAscii(buffer: Uint8Array): string | null {
	let asciiString = "";
	for (let i = 0; i < buffer.length; i++) {
		if (buffer[i]! > 127) {
			return null;
		}
		asciiString += String.fromCharCode(buffer[i]!);
	}
	return asciiString;
}

type Encoding = "base64" | "hex" | "utf8" | "ascii";

const toBuffer: Record<Encoding, (input: string) => Uint8Array | null> = {
	base64: base64ToBuffer,
	hex: hexToBuffer,
	utf8: utf8ToBuffer,
	ascii: asciiToBuffer,
};

const fromBuffer: Record<Encoding, (buffer: Uint8Array) => string | null> = {
	base64: bufferToBase64,
	hex: bufferToHex,
	utf8: bufferToUtf8,
	ascii: bufferToAscii,
};

function isValidEncoding(encoding: string): encoding is Encoding {
	return encoding === "base64" || encoding === "hex" || encoding === "utf8" || encoding === "ascii";
}

export const BinaryModule = {
	base64_to_hex: (base64: string): string => {
		const buffer = base64ToBuffer(String(base64));
		return buffer ? bufferToHex(buffer) : "";
	},

	hex_to_base64: (hex: string): string => {
		const buffer = hexToBuffer(String(hex));
		return buffer ? bufferToBase64(buffer) : "";
	},

	// Not part of Fastly VCL; kept as a local extension.
	data_convert: (input: string, inputEncoding: string, outputEncoding: string): string => {
		if (!isValidEncoding(inputEncoding) || !isValidEncoding(outputEncoding)) {
			return "";
		}
		const buffer = toBuffer[inputEncoding](input);
		if (!buffer) {
			return "";
		}
		return fromBuffer[outputEncoding](buffer) ?? "";
	},
};
