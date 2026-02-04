function base64ToBuffer(base64: string): Uint8Array | null {
	try {
		const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, "");
		const binaryString = atob(cleanBase64);
		const buffer = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			buffer[i] = binaryString.charCodeAt(i);
		}
		return buffer;
	} catch {
		return null;
	}
}

function hexToBuffer(hex: string): Uint8Array | null {
	try {
		const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, "");
		const paddedHex = cleanHex.length % 2 ? `0${cleanHex}` : cleanHex;
		const buffer = new Uint8Array(paddedHex.length / 2);
		for (let i = 0; i < paddedHex.length; i += 2) {
			buffer[i / 2] = parseInt(paddedHex.substring(i, i + 2), 16);
		}
		return buffer;
	} catch {
		return null;
	}
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

function bufferToHex(buffer: Uint8Array): string {
	let hexString = "";
	for (let i = 0; i < buffer.length; i++) {
		hexString += buffer[i]!.toString(16).padStart(2, "0");
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
		const buffer = base64ToBuffer(base64);
		return buffer ? bufferToHex(buffer) : "";
	},

	hex_to_base64: (hex: string): string => {
		const buffer = hexToBuffer(hex);
		return buffer ? bufferToBase64(buffer) : "";
	},

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
