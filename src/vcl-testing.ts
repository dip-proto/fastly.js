import { isNotSet, VCLString } from "./vcl-value";

export interface TestingState {
	_state: string;
	_restarted: boolean;
	_error: { status: number; message: string } | null;
	_subroutinesCalled: Map<string, number>;
	_injectedVariables: Map<string, any>;
	_mocks: Map<string, string>;
	_fixedTime: number | null;
	_fixedAccessRate: number | null;
	_overrideHost: string | null;
	_returnValue: any;
}

export function createTestingState(): TestingState {
	return {
		_state: "",
		_restarted: false,
		_error: null,
		_subroutinesCalled: new Map(),
		_injectedVariables: new Map(),
		_mocks: new Map(),
		_fixedTime: null,
		_fixedAccessRate: null,
		_overrideHost: null,
		_returnValue: null,
	};
}

export class AssertionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AssertionError";
	}
}

export function createAssertModule(state: TestingState) {
	return {
		equal: (actual: any, expected: any, message?: string) => {
			const a = normalizeValue(actual);
			const e = normalizeValue(expected);
			if (!looseEqual(a, e)) {
				throw new AssertionError(
					message || `Expected ${JSON.stringify(e)} but got ${JSON.stringify(a)}`,
				);
			}
		},
		not_equal: (actual: any, expected: any, message?: string) => {
			const a = normalizeValue(actual);
			const e = normalizeValue(expected);
			if (looseEqual(a, e)) {
				throw new AssertionError(
					message || `Expected ${JSON.stringify(a)} to not equal ${JSON.stringify(e)}`,
				);
			}
		},
		strict_equal: (actual: any, expected: any, message?: string) => {
			const a = normalizeValue(actual);
			const e = normalizeValue(expected);
			if (a !== e) {
				throw new AssertionError(
					message || `Expected ${JSON.stringify(e)} but got ${JSON.stringify(a)}`,
				);
			}
		},
		not_strict_equal: (actual: any, expected: any, message?: string) => {
			const a = normalizeValue(actual);
			const e = normalizeValue(expected);
			if (a === e) {
				throw new AssertionError(
					message ||
						`Expected ${JSON.stringify(a)} to not strictly equal ${JSON.stringify(e)}`,
				);
			}
		},
		equal_fold: (actual: any, expected: any, message?: string) => {
			const a = String(normalizeValue(actual)).toLowerCase();
			const e = String(normalizeValue(expected)).toLowerCase();
			if (a !== e) {
				throw new AssertionError(
					message ||
						`Expected ${JSON.stringify(e)} (case-insensitive) but got ${JSON.stringify(a)}`,
				);
			}
		},
		true: (value: any, message?: string) => {
			if (!isTruthy(value)) {
				throw new AssertionError(
					message || `Expected truthy value but got ${JSON.stringify(value)}`,
				);
			}
		},
		false: (value: any, message?: string) => {
			if (isTruthy(value)) {
				throw new AssertionError(
					message || `Expected falsy value but got ${JSON.stringify(value)}`,
				);
			}
		},
		contains: (haystack: any, needle: any, message?: string) => {
			const h = String(normalizeValue(haystack));
			const n = String(normalizeValue(needle));
			if (!h.includes(n)) {
				throw new AssertionError(message || `Expected "${h}" to contain "${n}"`);
			}
		},
		not_contains: (haystack: any, needle: any, message?: string) => {
			const h = String(normalizeValue(haystack));
			const n = String(normalizeValue(needle));
			if (h.includes(n)) {
				throw new AssertionError(message || `Expected "${h}" to not contain "${n}"`);
			}
		},
		starts_with: (str: any, prefix: any, message?: string) => {
			const s = String(normalizeValue(str));
			const p = String(normalizeValue(prefix));
			if (!s.startsWith(p)) {
				throw new AssertionError(message || `Expected "${s}" to start with "${p}"`);
			}
		},
		ends_with: (str: any, suffix: any, message?: string) => {
			const s = String(normalizeValue(str));
			const sf = String(normalizeValue(suffix));
			if (!s.endsWith(sf)) {
				throw new AssertionError(message || `Expected "${s}" to end with "${sf}"`);
			}
		},
		match: (str: any, pattern: any, message?: string) => {
			const s = String(normalizeValue(str));
			const p = String(normalizeValue(pattern));
			if (!new RegExp(p).test(s)) {
				throw new AssertionError(message || `Expected "${s}" to match pattern "${p}"`);
			}
		},
		not_match: (str: any, pattern: any, message?: string) => {
			const s = String(normalizeValue(str));
			const p = String(normalizeValue(pattern));
			if (new RegExp(p).test(s)) {
				throw new AssertionError(message || `Expected "${s}" to not match pattern "${p}"`);
			}
		},
		state: (expectedState: any, message?: string) => {
			const expected = String(normalizeValue(expectedState)).toLowerCase();
			const actual = state._state.toLowerCase();
			if (actual !== expected) {
				throw new AssertionError(
					message || `Expected state "${expected}" but got "${actual}"`,
				);
			}
		},
		not_state: (expectedState: any, message?: string) => {
			const expected = String(normalizeValue(expectedState)).toLowerCase();
			const actual = state._state.toLowerCase();
			if (actual === expected) {
				throw new AssertionError(message || `Expected state to not be "${expected}"`);
			}
		},
		restart: (message?: string) => {
			if (!state._restarted) {
				throw new AssertionError(message || "Expected restart but none occurred");
			}
		},
		not_restart: (message?: string) => {
			if (state._restarted) {
				throw new AssertionError(message || "Expected no restart but one occurred");
			}
		},
		error: (status?: any, responseText?: any, message?: string) => {
			if (!state._error) {
				throw new AssertionError(message || "Expected error but none occurred");
			}
			if (status !== undefined) {
				const expectedStatus = Number(status);
				if (state._error.status !== expectedStatus) {
					throw new AssertionError(
						message ||
							`Expected error status ${expectedStatus} but got ${state._error.status}`,
					);
				}
			}
			if (responseText !== undefined) {
				const expectedText = String(normalizeValue(responseText));
				if (state._error.message !== expectedText) {
					throw new AssertionError(
						message ||
							`Expected error message "${expectedText}" but got "${state._error.message}"`,
					);
				}
			}
		},
		not_error: (message?: string) => {
			if (state._error) {
				throw new AssertionError(
					message || `Expected no error but got error ${state._error.status}`,
				);
			}
		},
		is_notset: (value: any, message?: string) => {
			if (!isNotSet(value)) {
				throw new AssertionError(
					message || `Expected NOTSET but got ${JSON.stringify(value)}`,
				);
			}
		},
		is_json: (value: any, message?: string) => {
			try {
				JSON.parse(String(normalizeValue(value)));
			} catch {
				throw new AssertionError(
					message || `Expected valid JSON but got ${JSON.stringify(value)}`,
				);
			}
		},
		subroutine_called: (name: any, timesOrMessage?: any, message?: string) => {
			const subName = String(normalizeValue(name));
			const count = state._subroutinesCalled.get(subName) || 0;
			if (count === 0) {
				throw new AssertionError(
					(typeof timesOrMessage === "string" ? timesOrMessage : message) ||
						`Expected subroutine "${subName}" to be called but it was not`,
				);
			}
			if (typeof timesOrMessage === "number" && count !== timesOrMessage) {
				throw new AssertionError(
					message ||
						`Expected subroutine "${subName}" to be called ${timesOrMessage} times but was called ${count} times`,
				);
			}
		},
		not_subroutine_called: (name: any, message?: string) => {
			const subName = String(normalizeValue(name));
			const count = state._subroutinesCalled.get(subName) || 0;
			if (count > 0) {
				throw new AssertionError(
					message ||
						`Expected subroutine "${subName}" to not be called but it was called ${count} times`,
				);
			}
		},
	};
}

export function createTestingModule(
	state: TestingState,
	subroutines: Record<string, Function>,
	context: any,
) {
	return {
		call_subroutine: (name: any) => {
			const subName = String(normalizeValue(name));

			// Check for mocks
			const mockName = state._mocks.get(subName);
			const actualName = mockName || subName;

			// Track the original subroutine name call
			state._subroutinesCalled.set(
				subName,
				(state._subroutinesCalled.get(subName) || 0) + 1,
			);

			// Also track the actual name if different (for nested call tracking)
			if (mockName) {
				state._subroutinesCalled.set(
					mockName,
					(state._subroutinesCalled.get(mockName) || 0) + 1,
				);
			}

			if (!subroutines[actualName]) {
				throw new Error(`Subroutine "${actualName}" not found`);
			}

			const result = subroutines[actualName]!(context);
			// Capture return value from functional subroutines
			state._returnValue = context.locals?.__return_value__ ?? null;
			if (result) {
				const resultStr = String(result).toLowerCase();
				if (resultStr === "restart") {
					state._restarted = true;
					state._state = "RESTART";
				} else if (resultStr === "error") {
					state._error = {
						status: context.obj.status || 0,
						message: context.obj.response || "",
					};
					state._state = "ERROR";
				} else {
					state._state = resultStr.toUpperCase();
				}
			}
		},
		inspect: (path: any) => {
			const varPath = String(normalizeValue(path));
			if (varPath === "obj.status") return context.obj.status;
			if (varPath === "obj.response") return context.obj.response;
			if (varPath === "req.url") return context.req.url;
			if (varPath === "req.method") return context.req.method;
			if (varPath === "req.backend") return context.req.backend;
			if (varPath.startsWith("req.http.")) {
				const header = varPath.substring(9);
				return context.req.http[header] ?? VCLString.notset();
			}
			if (varPath.startsWith("resp.http.")) {
				const header = varPath.substring(10);
				return context.resp.http[header] ?? VCLString.notset();
			}
			if (varPath.startsWith("beresp.")) {
				const field = varPath.substring(7);
				return (context.beresp as any)[field];
			}
			return null;
		},
		inject_variable: (name: any, value: any) => {
			state._injectedVariables.set(String(normalizeValue(name)), value);
		},
		override_host: (host: any) => {
			state._overrideHost = String(normalizeValue(host));
			context.req.http.Host = state._overrideHost;
		},
		mock: (original: any, mock: any) => {
			state._mocks.set(String(normalizeValue(original)), String(normalizeValue(mock)));
		},
		restore_mock: (...names: any[]) => {
			for (const name of names) {
				state._mocks.delete(String(normalizeValue(name)));
			}
		},
		restore_all_mocks: () => {
			state._mocks.clear();
		},
		table_set: (tableName: any, key: any, value: any) => {
			const tn = String(normalizeValue(tableName));
			if (!context.tables[tn]) {
				context.tables[tn] = { name: tn, entries: {} };
			}
			context.tables[tn].entries[String(normalizeValue(key))] = String(normalizeValue(value));
		},
		table_merge: (baseTableName: any, mergeTableName: any) => {
			const baseName = String(normalizeValue(baseTableName));
			const mergeName = String(normalizeValue(mergeTableName));
			if (!context.tables[baseName]) {
				context.tables[baseName] = { name: baseName, entries: {} };
			}
			const mergeTable = context.tables[mergeName];
			if (mergeTable) {
				Object.assign(context.tables[baseName].entries, mergeTable.entries);
			}
		},
		fixed_time: (time: any) => {
			state._fixedTime = Number(time);
		},
		fixed_access_rate: (rate: any) => {
			state._fixedAccessRate = Number(rate);
		},
		set_backend_health: (backendName: any, healthy: any) => {
			const name = String(normalizeValue(backendName));
			if (context.backends[name]) {
				context.backends[name].is_healthy = Boolean(healthy);
			}
		},
		get_env: (name: any) => {
			const val = process.env[String(normalizeValue(name))];
			return val !== undefined ? val : VCLString.notset();
		},
		return_value: () => state._returnValue,
	};
}

function normalizeValue(value: any): any {
	if (value instanceof VCLString) {
		return value.toString();
	}
	return value;
}

function looseEqual(a: any, b: any): boolean {
	// Handle numeric comparison (int vs float)
	if (typeof a === "number" && typeof b === "number") {
		return a === b;
	}
	// String to number comparison
	if (typeof a === "number" && typeof b === "string") {
		return a === Number(b) || String(a) === b;
	}
	if (typeof a === "string" && typeof b === "number") {
		return Number(a) === b || a === String(b);
	}
	return a === b;
}

function isTruthy(value: any): boolean {
	if (value === true) return true;
	if (value === false) return false;
	if (value === 0) return false;
	if (value === 1) return true;
	if (typeof value === "string") return value !== "" && value !== "0";
	if (value instanceof VCLString) return !isNotSet(value) && value.toString() !== "";
	return Boolean(value);
}
