/**
 * VCL Address Module
 *
 * This module provides address-related functionality for the VCL implementation,
 * including IP address validation, classification, and bit manipulation.
 */

/**
 * Helper function to check if a string is a valid IPv4 address
 */
function isValidIPv4(ip: string): boolean {
  // IPv4 regex pattern
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  
  if (!ipv4Pattern.test(ip)) {
    return false;
  }
  
  // Check if each octet is valid (0-255)
  const octets = ip.split('.');
  for (const octet of octets) {
    const num = parseInt(octet, 10);
    if (num < 0 || num > 255) {
      return false;
    }
  }
  
  return true;
}

/**
 * Helper function to check if a string is a valid IPv6 address
 */
function isValidIPv6(ip: string): boolean {
  // Basic IPv6 regex pattern
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
  
  return ipv6Pattern.test(ip);
}

/**
 * Helper function to check if a string is a valid Unix socket path
 */
function isValidUnixSocket(path: string): boolean {
  // Unix socket paths typically start with / and don't contain null bytes
  return typeof path === 'string' && path.startsWith('/') && !path.includes('\0');
}

/**
 * Helper function to convert an IPv4 address to a 32-bit integer
 */
function ipv4ToInt(ip: string): number {
  if (!isValidIPv4(ip)) {
    return 0;
  }
  
  const octets = ip.split('.');
  return (
    (parseInt(octets[0], 10) << 24) |
    (parseInt(octets[1], 10) << 16) |
    (parseInt(octets[2], 10) << 8) |
    parseInt(octets[3], 10)
  );
}

/**
 * Helper function to extract bits from an IPv4 address
 */
function extractBitsFromIPv4(ip: string, offset: number, length: number): number {
  if (!isValidIPv4(ip) || offset < 0 || offset > 31 || length < 1 || length > 32 || offset + length > 32) {
    return 0;
  }
  
  const ipInt = ipv4ToInt(ip);
  
  // Create a mask for the bits we want to extract
  const mask = ((1 << length) - 1) << (32 - offset - length);
  
  // Extract the bits and shift them to the right
  return (ipInt & mask) >>> (32 - offset - length);
}

/**
 * Helper function to extract bits from an IPv6 address
 * Note: This is a simplified implementation that handles only the first 32 bits
 */
function extractBitsFromIPv6(ip: string, offset: number, length: number): number {
  if (!isValidIPv6(ip) || offset < 0 || length < 1) {
    return 0;
  }
  
  // For simplicity, we'll only handle the first 32 bits
  if (offset > 31 || length > 32 || offset + length > 32) {
    return 0;
  }
  
  // Get the first 32 bits of the IPv6 address
  const parts = ip.split(':');
  const firstTwoGroups = parts.slice(0, 2).map(part => parseInt(part, 16));
  
  // Convert to a 32-bit integer
  const ipInt = (firstTwoGroups[0] << 16) | (firstTwoGroups[1] || 0);
  
  // Create a mask for the bits we want to extract
  const mask = ((1 << length) - 1) << (32 - offset - length);
  
  // Extract the bits and shift them to the right
  return (ipInt & mask) >>> (32 - offset - length);
}

/**
 * Address Functions Module
 */
export const AddressModule = {
  /**
   * Determines if a given address is an IPv4 address.
   */
  is_ipv4: (address: string): boolean => {
    return isValidIPv4(address);
  },
  
  /**
   * Determines if a given address is an IPv6 address.
   */
  is_ipv6: (address: string): boolean => {
    return isValidIPv6(address);
  },
  
  /**
   * Determines if a given address is a Unix domain socket address.
   */
  is_unix: (address: string): boolean => {
    return isValidUnixSocket(address);
  },
  
  /**
   * Extracts a range of bits from an IP address.
   */
  extract_bits: (address: string, offset: number, length: number): number => {
    if (isValidIPv4(address)) {
      return extractBitsFromIPv4(address, offset, length);
    } else if (isValidIPv6(address)) {
      return extractBitsFromIPv6(address, offset, length);
    }
    
    return 0;
  }
};
