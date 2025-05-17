/**
 * VCL Query String Module
 *
 * This module provides query string manipulation functionality for the VCL implementation,
 * including getting, setting, adding, removing, and filtering query string parameters.
 */

/**
 * Helper function to parse a query string into URLSearchParams
 */
function parseQueryString(queryString: string): URLSearchParams {
  // Remove leading '?' if present
  const cleanQueryString = queryString.startsWith('?') 
    ? queryString.substring(1) 
    : queryString;
  
  return new URLSearchParams(cleanQueryString);
}

/**
 * Query String Functions Module
 */
export const QueryStringModule = {
  /**
   * Gets the value of a parameter from a query string.
   */
  get: (queryString: string, paramName: string): string | null => {
    try {
      const params = parseQueryString(String(queryString));
      return params.get(String(paramName));
    } catch (error) {
      console.error(`Error in querystring.get: ${error}`);
      return null;
    }
  },
  
  /**
   * Sets a parameter in a query string, replacing any existing values.
   */
  set: (queryString: string, paramName: string, paramValue: string): string => {
    try {
      const params = parseQueryString(String(queryString));
      params.set(String(paramName), String(paramValue));
      return params.toString();
    } catch (error) {
      console.error(`Error in querystring.set: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Adds a parameter to a query string, preserving any existing values.
   */
  add: (queryString: string, paramName: string, paramValue: string): string => {
    try {
      const params = parseQueryString(String(queryString));
      params.append(String(paramName), String(paramValue));
      return params.toString();
    } catch (error) {
      console.error(`Error in querystring.add: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Removes a parameter from a query string.
   */
  remove: (queryString: string, paramName: string): string => {
    try {
      const params = parseQueryString(String(queryString));
      params.delete(String(paramName));
      return params.toString();
    } catch (error) {
      console.error(`Error in querystring.remove: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Removes empty parameters from a query string.
   */
  clean: (queryString: string): string => {
    try {
      const params = parseQueryString(String(queryString));
      const cleanParams = new URLSearchParams();
      
      // Only keep parameters with non-empty values
      for (const [name, value] of params.entries()) {
        if (value !== '') {
          cleanParams.append(name, value);
        }
      }
      
      return cleanParams.toString();
    } catch (error) {
      console.error(`Error in querystring.clean: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Keeps only the specified parameters in a query string.
   */
  filter: (queryString: string, paramNames: string[]): string => {
    try {
      const params = parseQueryString(String(queryString));
      const filteredParams = new URLSearchParams();
      
      // Only keep parameters in the names array
      for (const name of paramNames) {
        const values = params.getAll(name);
        for (const value of values) {
          filteredParams.append(name, value);
        }
      }
      
      return filteredParams.toString();
    } catch (error) {
      console.error(`Error in querystring.filter: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Keeps all parameters except the specified ones in a query string.
   */
  filter_except: (queryString: string, paramNames: string[]): string => {
    try {
      const params = parseQueryString(String(queryString));
      const filteredParams = new URLSearchParams();
      
      // Keep all parameters except those in the names array
      for (const [name, value] of params.entries()) {
        if (!paramNames.includes(name)) {
          filteredParams.append(name, value);
        }
      }
      
      return filteredParams.toString();
    } catch (error) {
      console.error(`Error in querystring.filter_except: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Removes parameters with a specific prefix and separator from a query string.
   */
  filtersep: (queryString: string, prefix: string, separator: string): string => {
    try {
      const params = parseQueryString(String(queryString));
      const filteredParams = new URLSearchParams();
      
      // Create a regex to match parameters with the given prefix and separator
      const regex = new RegExp(`^${prefix}${separator}`);
      
      // Keep all parameters that don't match the pattern
      for (const [name, value] of params.entries()) {
        if (!regex.test(name)) {
          filteredParams.append(name, value);
        }
      }
      
      return filteredParams.toString();
    } catch (error) {
      console.error(`Error in querystring.filtersep: ${error}`);
      return String(queryString);
    }
  },
  
  /**
   * Sorts the parameters in a query string alphabetically by name.
   */
  sort: (queryString: string): string => {
    try {
      const params = parseQueryString(String(queryString));
      const sortedParams = new URLSearchParams();
      
      // Get all parameter names and sort them
      const names = Array.from(new Set(Array.from(params.keys()))).sort();
      
      // Add parameters in sorted order
      for (const name of names) {
        const values = params.getAll(name);
        for (const value of values) {
          sortedParams.append(name, value);
        }
      }
      
      return sortedParams.toString();
    } catch (error) {
      console.error(`Error in querystring.sort: ${error}`);
      return String(queryString);
    }
  }
};
