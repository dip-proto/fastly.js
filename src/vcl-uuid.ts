/**
 * VCL UUID Module
 *
 * This module provides UUID (Universally Unique Identifier) functionality for the VCL implementation,
 * including generation, validation, and conversion of UUIDs.
 */

import {v3 as uuidv3, v4 as uuidv4, v5 as uuidv5, validate, version, parse, stringify} from 'uuid';

// Standard namespace UUIDs
const NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
const NAMESPACE_X500 = '6ba7b814-9dad-11d1-80b4-00c04fd430c8';

/**
 * UUID Functions Module
 */
export const UUIDModule = {
  /**
   * Generates a version 3 UUID (namespace + name, MD5)
   */
  version3: (namespace: string, name: string): string => {
    try {
      return uuidv3(String(name), String(namespace));
    } catch (error) {
      console.error(`Error in uuid.version3: ${ error }`);
      return '';
    }
  },

  /**
   * Generates a version 4 UUID (random)
   */
  version4: (): string => {
    try {
      return uuidv4();
    } catch (error) {
      console.error(`Error in uuid.version4: ${ error }`);
      return '';
    }
  },

  /**
   * Generates a version 5 UUID (namespace + name, SHA-1)
   */
  version5: (namespace: string, name: string): string => {
    try {
      return uuidv5(String(name), String(namespace));
    } catch (error) {
      console.error(`Error in uuid.version5: ${ error }`);
      return '';
    }
  },

  /**
   * Generates a DNS namespace UUID (version 5)
   */
  dns: (name: string): string => {
    try {
      return uuidv5(String(name), NAMESPACE_DNS);
    } catch (error) {
      console.error(`Error in uuid.dns: ${ error }`);
      return '';
    }
  },

  /**
   * Generates a URL namespace UUID (version 5)
   */
  url: (name: string): string => {
    try {
      return uuidv5(String(name), NAMESPACE_URL);
    } catch (error) {
      console.error(`Error in uuid.url: ${ error }`);
      return '';
    }
  },

  /**
   * Validates if a string is a valid UUID
   */
  is_valid: (uuid: string): boolean => {
    try {
      return validate(String(uuid));
    } catch (error) {
      console.error(`Error in uuid.is_valid: ${ error }`);
      return false;
    }
  },

  /**
   * Checks if a UUID is version 3
   */
  is_version3: (uuid: string): boolean => {
    try {
      return validate(String(uuid)) && version(String(uuid)) === 3;
    } catch (error) {
      console.error(`Error in uuid.is_version3: ${ error }`);
      return false;
    }
  },

  /**
   * Checks if a UUID is version 4
   */
  is_version4: (uuid: string): boolean => {
    try {
      return validate(String(uuid)) && version(String(uuid)) === 4;
    } catch (error) {
      console.error(`Error in uuid.is_version4: ${ error }`);
      return false;
    }
  },

  /**
   * Checks if a UUID is version 5
   */
  is_version5: (uuid: string): boolean => {
    try {
      return validate(String(uuid)) && version(String(uuid)) === 5;
    } catch (error) {
      console.error(`Error in uuid.is_version5: ${ error }`);
      return false;
    }
  },

  /**
   * Decodes a UUID to binary
   */
  decode: (uuid: string): Uint8Array | null => {
    try {
      if (!validate(String(uuid))) {
        return null;
      }

      return parse(String(uuid));
    } catch (error) {
      console.error(`Error in uuid.decode: ${ error }`);
      return null;
    }
  },

  /**
   * Encodes binary data to a UUID
   */
  encode: (binary: any): string => {
    try {
      // If binary is a string representation of an array, convert it to an actual array
      if (typeof binary === 'string') {
        const values = binary.split(',').map(Number);
        binary = new Uint8Array(values);
      }

      // Ensure binary is a Uint8Array with 16 bytes
      if (!(binary instanceof Uint8Array) || binary.length !== 16) {
        return '';
      }

      return stringify(binary);
    } catch (error) {
      console.error(`Error in uuid.encode: ${ error }`);
      return '';
    }
  }
};
