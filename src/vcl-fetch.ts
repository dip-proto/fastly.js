/**
 * VCL Fetch Module
 *
 * This module provides functionality to fetch resources for ESI processing.
 */

import { VCLContext } from './vcl';

/**
 * Fetch a resource from a URL or path
 * 
 * @param url The URL or path to fetch
 * @param context The VCL context
 * @returns The fetched content
 */
export function fetchResource(url: string, context: VCLContext): string {
  // For now, this is a mock implementation
  // In a real implementation, this would make an HTTP request to fetch the resource
  
  // Check if the URL is absolute or relative
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Absolute URL - would make an external request in a real implementation
    return mockFetchExternalResource(url);
  } else {
    // Relative URL - would make an internal request in a real implementation
    return mockFetchInternalResource(url, context);
  }
}

/**
 * Mock function to fetch an external resource
 * 
 * @param url The URL to fetch
 * @returns Mock content for the resource
 */
function mockFetchExternalResource(url: string): string {
  // In a real implementation, this would make an HTTP request
  // For now, return mock content based on the URL
  
  if (url.includes('header')) {
    return `<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
</header>`;
  } else if (url.includes('footer')) {
    return `<footer>
  <p>&copy; 2023 Example Company</p>
  <p><a href="/privacy">Privacy Policy</a> | <a href="/terms">Terms of Service</a></p>
</footer>`;
  } else if (url.includes('user-profile')) {
    return `<div class="user-profile">
  <h2>Welcome, User!</h2>
  <p>Your account is in good standing.</p>
</div>`;
  } else {
    return `<div>Content for ${url}</div>`;
  }
}

/**
 * Mock function to fetch an internal resource
 * 
 * @param path The path to fetch
 * @param context The VCL context
 * @returns Mock content for the resource
 */
function mockFetchInternalResource(path: string, context: VCLContext): string {
  // In a real implementation, this would make an internal request
  // For now, return mock content based on the path
  
  if (path === '/header') {
    return `<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
</header>`;
  } else if (path === '/footer') {
    return `<footer>
  <p>&copy; 2023 Example Company</p>
  <p><a href="/privacy">Privacy Policy</a> | <a href="/terms">Terms of Service</a></p>
</footer>`;
  } else if (path === '/api/user-profile') {
    // Check if user is logged in (has a user cookie)
    const userCookie = context.req.http.Cookie || '';
    if (userCookie.includes('user=')) {
      return `<div class="user-profile">
  <h2>Welcome, User!</h2>
  <p>Your account is in good standing.</p>
</div>`;
    } else {
      return `<div class="user-profile">
  <h2>Welcome, Guest!</h2>
  <p><a href="/login">Log in</a> or <a href="/signup">Sign up</a></p>
</div>`;
    }
  } else {
    return `<div>Content for ${path}</div>`;
  }
}
