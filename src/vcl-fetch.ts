/**
 * VCL Fetch Module
 * Provides resource fetching functionality for ESI processing.
 */

import type { VCLContext } from "./vcl";

export function fetchResource(url: string, context: VCLContext): string {
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return mockFetchExternalResource(url);
	}
	return mockFetchInternalResource(url, context);
}

function mockFetchExternalResource(url: string): string {
	if (url.includes("header")) {
		return getHeaderTemplate();
	}
	if (url.includes("footer")) {
		return getFooterTemplate();
	}
	if (url.includes("user-profile")) {
		return getUserProfileTemplate(true);
	}
	return `<div>Content for ${url}</div>`;
}

function mockFetchInternalResource(path: string, context: VCLContext): string {
	if (path === "/header") {
		return getHeaderTemplate();
	}
	if (path === "/footer") {
		return getFooterTemplate();
	}
	if (path === "/api/user-profile") {
		const userCookie = context.req.http.Cookie || "";
		const isLoggedIn = userCookie.includes("user=");
		return getUserProfileTemplate(isLoggedIn);
	}
	return `<div>Content for ${path}</div>`;
}

function getHeaderTemplate(): string {
	return `<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
</header>`;
}

function getFooterTemplate(): string {
	return `<footer>
  <p>&copy; 2023 Example Company</p>
  <p><a href="/privacy">Privacy Policy</a> | <a href="/terms">Terms of Service</a></p>
</footer>`;
}

function getUserProfileTemplate(isLoggedIn: boolean): string {
	if (isLoggedIn) {
		return `<div class="user-profile">
  <h2>Welcome, User!</h2>
  <p>Your account is in good standing.</p>
</div>`;
	}
	return `<div class="user-profile">
  <h2>Welcome, Guest!</h2>
  <p><a href="/login">Log in</a> or <a href="/signup">Sign up</a></p>
</div>`;
}
