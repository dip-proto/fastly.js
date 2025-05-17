/**
 * VCL Digest Module
 *
 * This module provides cryptographic functionality for the VCL implementation,
 * including hashing, HMAC, and Base64 encoding/decoding.
 */

// Import the crypto module
import * as crypto from 'crypto';

/**
 * Digest Functions Module
 */
export const DigestModule = {
  /**
   * Generates an MD5 hash of the input string.
   */
  hash_md5: (input: string): string => {
    return crypto.createHash('md5').update(String(input)).digest('hex');
  },
  
  /**
   * Generates a SHA-1 hash of the input string.
   */
  hash_sha1: (input: string): string => {
    return crypto.createHash('sha1').update(String(input)).digest('hex');
  },
  
  /**
   * Generates a SHA-256 hash of the input string.
   */
  hash_sha256: (input: string): string => {
    return crypto.createHash('sha256').update(String(input)).digest('hex');
  },
  
  /**
   * Generates a SHA-512 hash of the input string.
   */
  hash_sha512: (input: string): string => {
    return crypto.createHash('sha512').update(String(input)).digest('hex');
  },
  
  /**
   * Generates a 32-bit xxHash of the input string.
   * Note: This is a simplified implementation as Node.js doesn't have built-in xxHash.
   */
  hash_xxh32: (input: string): string => {
    // Fallback to a simple hash for now
    const hash = crypto.createHash('md5').update(String(input)).digest('hex');
    return hash.substring(0, 8); // Return first 8 characters (32 bits)
  },
  
  /**
   * Generates a 64-bit xxHash of the input string.
   * Note: This is a simplified implementation as Node.js doesn't have built-in xxHash.
   */
  hash_xxh64: (input: string): string => {
    // Fallback to a simple hash for now
    const hash = crypto.createHash('md5').update(String(input)).digest('hex');
    return hash.substring(0, 16); // Return first 16 characters (64 bits)
  },
  
  /**
   * Generates an HMAC using MD5.
   */
  hmac_md5: (key: string, input: string): string => {
    return crypto.createHmac('md5', String(key))
      .update(String(input))
      .digest('hex');
  },
  
  /**
   * Generates an HMAC using SHA-1.
   */
  hmac_sha1: (key: string, input: string): string => {
    return crypto.createHmac('sha1', String(key))
      .update(String(input))
      .digest('hex');
  },
  
  /**
   * Generates an HMAC using SHA-256.
   */
  hmac_sha256: (key: string, input: string): string => {
    return crypto.createHmac('sha256', String(key))
      .update(String(input))
      .digest('hex');
  },
  
  /**
   * Generates an HMAC using SHA-512.
   */
  hmac_sha512: (key: string, input: string): string => {
    return crypto.createHmac('sha512', String(key))
      .update(String(input))
      .digest('hex');
  },
  
  /**
   * Generates a base64-encoded HMAC using MD5.
   */
  hmac_md5_base64: (key: string, input: string): string => {
    return crypto.createHmac('md5', String(key))
      .update(String(input))
      .digest('base64');
  },
  
  /**
   * Generates a base64-encoded HMAC using SHA-1.
   */
  hmac_sha1_base64: (key: string, input: string): string => {
    return crypto.createHmac('sha1', String(key))
      .update(String(input))
      .digest('base64');
  },
  
  /**
   * Generates a base64-encoded HMAC using SHA-256.
   */
  hmac_sha256_base64: (key: string, input: string): string => {
    return crypto.createHmac('sha256', String(key))
      .update(String(input))
      .digest('base64');
  },
  
  /**
   * Generates a base64-encoded HMAC using SHA-512.
   */
  hmac_sha512_base64: (key: string, input: string): string => {
    return crypto.createHmac('sha512', String(key))
      .update(String(input))
      .digest('base64');
  },
  
  /**
   * Compares two strings in a way that is not vulnerable to timing attacks.
   */
  secure_is_equal: (a: string, b: string): boolean => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(String(a)),
        Buffer.from(String(b))
      );
    } catch (e) {
      // If buffers are not the same length, return false
      return false;
    }
  },
  
  /**
   * Encodes a string using standard Base64.
   */
  base64: (input: string): string => {
    return Buffer.from(String(input)).toString('base64');
  },
  
  /**
   * Decodes a standard Base64-encoded string.
   */
  base64_decode: (input: string): string => {
    try {
      return Buffer.from(String(input), 'base64').toString('utf-8');
    } catch (e) {
      return '';
    }
  },
  
  /**
   * Encodes a string using URL-safe Base64.
   */
  base64url: (input: string): string => {
    return Buffer.from(String(input))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },
  
  /**
   * Decodes a URL-safe Base64-encoded string.
   */
  base64url_decode: (input: string): string => {
    try {
      // Convert URL-safe characters back to standard Base64
      const base64 = String(input)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      // Add padding if needed
      const padding = base64.length % 4;
      const paddedBase64 = padding ? 
        base64 + '='.repeat(4 - padding) : 
        base64;
      
      return Buffer.from(paddedBase64, 'base64').toString('utf-8');
    } catch (e) {
      return '';
    }
  },
  
  /**
   * Encodes a string using URL-safe Base64 without padding.
   */
  base64url_nopad: (input: string): string => {
    return Buffer.from(String(input))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },
  
  /**
   * Decodes a URL-safe Base64-encoded string without padding.
   */
  base64url_nopad_decode: (input: string): string => {
    return DigestModule.base64url_decode(input);
  }
};
