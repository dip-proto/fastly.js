/**
 * VCL Binary Data Module
 *
 * This module provides binary data manipulation functionality for the VCL implementation,
 * including conversion between different encodings such as base64, hex, UTF-8, and ASCII.
 */

/**
 * Helper function to convert a base64 string to a binary buffer
 */
function base64ToBuffer(base64: string): Uint8Array | null {
  try {
    // Remove any padding characters that might cause issues
    const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
    
    // Convert base64 to binary string
    const binaryString = atob(cleanBase64);
    
    // Convert binary string to Uint8Array
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }
    
    return buffer;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to convert a hex string to a binary buffer
 */
function hexToBuffer(hex: string): Uint8Array | null {
  try {
    // Remove any non-hex characters
    const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
    
    // Ensure we have an even number of characters
    const paddedHex = cleanHex.length % 2 ? '0' + cleanHex : cleanHex;
    
    // Convert hex to Uint8Array
    const buffer = new Uint8Array(paddedHex.length / 2);
    for (let i = 0; i < paddedHex.length; i += 2) {
      buffer[i / 2] = parseInt(paddedHex.substring(i, i + 2), 16);
    }
    
    return buffer;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to convert a UTF-8 string to a binary buffer
 */
function utf8ToBuffer(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * Helper function to convert an ASCII string to a binary buffer
 */
function asciiToBuffer(text: string): Uint8Array | null {
  try {
    const buffer = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      if (charCode > 127) {
        // Not a valid ASCII character
        return null;
      }
      buffer[i] = charCode;
    }
    return buffer;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to convert a binary buffer to a base64 string
 */
function bufferToBase64(buffer: Uint8Array): string {
  // Convert Uint8Array to binary string
  let binaryString = '';
  for (let i = 0; i < buffer.length; i++) {
    binaryString += String.fromCharCode(buffer[i]);
  }
  
  // Convert binary string to base64
  return btoa(binaryString);
}

/**
 * Helper function to convert a binary buffer to a hex string
 */
function bufferToHex(buffer: Uint8Array): string {
  // Convert Uint8Array to hex string
  let hexString = '';
  for (let i = 0; i < buffer.length; i++) {
    const hex = buffer[i].toString(16).padStart(2, '0');
    hexString += hex;
  }
  
  return hexString;
}

/**
 * Helper function to convert a binary buffer to a UTF-8 string
 */
function bufferToUtf8(buffer: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(buffer);
}

/**
 * Helper function to convert a binary buffer to an ASCII string
 */
function bufferToAscii(buffer: Uint8Array): string | null {
  try {
    let asciiString = '';
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > 127) {
        // Not a valid ASCII character
        return null;
      }
      asciiString += String.fromCharCode(buffer[i]);
    }
    return asciiString;
  } catch (error) {
    return null;
  }
}

/**
 * Binary Data Functions Module
 */
export const BinaryModule = {
  /**
   * Converts a base64-encoded string to a hexadecimal string.
   */
  base64_to_hex: (base64: string): string => {
    const buffer = base64ToBuffer(base64);
    if (!buffer) {
      return '';
    }
    
    return bufferToHex(buffer);
  },
  
  /**
   * Converts a hexadecimal string to a base64-encoded string.
   */
  hex_to_base64: (hex: string): string => {
    const buffer = hexToBuffer(hex);
    if (!buffer) {
      return '';
    }
    
    return bufferToBase64(buffer);
  },
  
  /**
   * Converts binary data between different encodings.
   */
  data_convert: (input: string, inputEncoding: string, outputEncoding: string): string => {
    // Validate encodings
    const validEncodings = ['base64', 'hex', 'utf8', 'ascii'];
    if (!validEncodings.includes(inputEncoding) || !validEncodings.includes(outputEncoding)) {
      return '';
    }
    
    // Convert input to buffer based on input encoding
    let buffer: Uint8Array | null = null;
    
    if (inputEncoding === 'base64') {
      buffer = base64ToBuffer(input);
    } else if (inputEncoding === 'hex') {
      buffer = hexToBuffer(input);
    } else if (inputEncoding === 'utf8') {
      buffer = utf8ToBuffer(input);
    } else if (inputEncoding === 'ascii') {
      buffer = asciiToBuffer(input);
    }
    
    if (!buffer) {
      return '';
    }
    
    // Convert buffer to output based on output encoding
    if (outputEncoding === 'base64') {
      return bufferToBase64(buffer);
    } else if (outputEncoding === 'hex') {
      return bufferToHex(buffer);
    } else if (outputEncoding === 'utf8') {
      return bufferToUtf8(buffer);
    } else if (outputEncoding === 'ascii') {
      const result = bufferToAscii(buffer);
      return result !== null ? result : '';
    }
    
    return '';
  }
};
