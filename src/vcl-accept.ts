/**
 * VCL Accept Header Module
 *
 * This module provides functionality for parsing and working with HTTP Accept headers
 * according to RFC standards, including language, charset, encoding, and media type negotiation.
 */

/**
 * Interface for a parsed Accept header value with quality factor
 */
interface AcceptValue {
  value: string;
  quality: number;
}

/**
 * Helper function to parse an Accept header into an array of values with quality factors
 */
function parseAcceptHeader(header: string): AcceptValue[] {
  if (!header) {
    return [];
  }
  
  return header.split(',')
    .map(part => {
      const [value, quality] = part.trim().split(';q=');
      return {
        value: value.trim(),
        quality: quality ? parseFloat(quality) : 1.0
      };
    })
    .sort((a, b) => b.quality - a.quality); // Sort by quality descending
}

/**
 * Helper function to find the best match from available options
 */
function findBestMatch(acceptValues: AcceptValue[], availableOptions: string[]): string | null {
  // Check for exact matches first
  for (const acceptValue of acceptValues) {
    if (availableOptions.includes(acceptValue.value)) {
      return acceptValue.value;
    }
  }
  
  // For language headers, also check for language base matches (e.g., 'en-US' matches 'en')
  for (const acceptValue of acceptValues) {
    const baseLang = acceptValue.value.split('-')[0];
    if (baseLang !== acceptValue.value && availableOptions.includes(baseLang)) {
      return baseLang;
    }
  }
  
  // For media types, check for wildcard matches
  for (const acceptValue of acceptValues) {
    if (acceptValue.value === '*/*' && availableOptions.length > 0) {
      return availableOptions[0];
    }
    
    const [type, subtype] = acceptValue.value.split('/');
    if (subtype === '*') {
      for (const option of availableOptions) {
        const [optionType] = option.split('/');
        if (optionType === type) {
          return option;
        }
      }
    }
  }
  
  return null;
}

/**
 * Accept Header Functions Module
 */
export const AcceptModule = {
  /**
   * Selects the best match from an Accept-Language header value against available languages.
   */
  language_lookup: (availableLanguages: string, defaultLanguage: string, acceptLanguageHeader: string): string => {
    if (!acceptLanguageHeader) {
      return defaultLanguage;
    }
    
    const available = availableLanguages.split(':');
    const acceptValues = parseAcceptHeader(acceptLanguageHeader);
    
    // Find the best match
    const bestMatch = findBestMatch(acceptValues, available);
    
    return bestMatch || defaultLanguage;
  },
  
  /**
   * Selects the best match from an Accept-Charset header value against available charsets.
   */
  charset_lookup: (availableCharsets: string, defaultCharset: string, acceptCharsetHeader: string): string => {
    if (!acceptCharsetHeader) {
      return defaultCharset;
    }
    
    const available = availableCharsets.split(':');
    const acceptValues = parseAcceptHeader(acceptCharsetHeader);
    
    // Find the best match
    const bestMatch = findBestMatch(acceptValues, available);
    
    return bestMatch || defaultCharset;
  },
  
  /**
   * Selects the best match from an Accept-Encoding header value against available encodings.
   */
  encoding_lookup: (availableEncodings: string, defaultEncoding: string, acceptEncodingHeader: string): string => {
    if (!acceptEncodingHeader) {
      return defaultEncoding;
    }
    
    const available = availableEncodings.split(':');
    const acceptValues = parseAcceptHeader(acceptEncodingHeader);
    
    // Find the best match
    const bestMatch = findBestMatch(acceptValues, available);
    
    return bestMatch || defaultEncoding;
  },
  
  /**
   * Selects the best match from an Accept header value against available media types.
   */
  media_lookup: (availableMediaTypes: string, defaultMediaType: string, mediaTypePatterns: string, acceptHeader: string): string => {
    if (!acceptHeader) {
      return defaultMediaType;
    }
    
    const available = availableMediaTypes.split(':');
    const acceptValues = parseAcceptHeader(acceptHeader);
    
    // Find the best match
    const bestMatch = findBestMatch(acceptValues, available);
    
    return bestMatch || defaultMediaType;
  }
};
