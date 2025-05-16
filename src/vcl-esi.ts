/**
 * VCL ESI (Edge Side Includes) Module
 * Parses and processes ESI tags in HTML content per the Fastly VCL specification.
 */

import type { VCLContext } from "./vcl";

export enum ESITagType {
	INCLUDE = "include",
	REMOVE = "remove",
	COMMENT = "comment",
	CHOOSE = "choose",
	WHEN = "when",
	OTHERWISE = "otherwise",
	VARS = "vars",
}

export interface ESITag {
	type: ESITagType;
	content?: string;
	attributes?: Record<string, string>;
	children?: ESITag[];
	parent?: ESITag;
}

export class ESIParser {
	private content: string;
	private position: number = 0;
	private tags: ESITag[] = [];

	constructor(content: string) {
		this.content = content;
	}

	parse(): ESITag[] {
		this.position = 0;
		this.tags = [];

		while (this.position < this.content.length) {
			const tagStart = this.content.indexOf("<esi:", this.position);
			if (tagStart === -1) {
				break;
			}

			this.position = tagStart;
			const tag = this.parseTag();
			if (tag) {
				this.tags.push(tag);
			}
		}

		return this.tags;
	}

	private parseTag(): ESITag | null {
		const tagNameMatch = this.content
			.substring(this.position)
			.match(/<esi:([a-z]+)/i);
		if (!tagNameMatch) {
			this.position++;
			return null;
		}

		const tagName = tagNameMatch[1].toLowerCase();
		const tagType = this.getTagType(tagName);
		if (!tagType) {
			this.position++;
			return null;
		}

		const tagEndPos = this.content.indexOf(">", this.position);
		if (tagEndPos === -1) {
			this.position++;
			return null;
		}

		const tagContent = this.content.substring(this.position, tagEndPos + 1);
		const attributes = this.parseAttributes(tagContent);
		const tag: ESITag = { type: tagType, attributes };

		this.position = tagEndPos + 1;

		if (tagContent.endsWith("/>")) {
			return tag;
		}

		const closingTag = `</esi:${tagName}>`;
		const closingTagPos = this.content.indexOf(closingTag, this.position);

		if (closingTagPos === -1) {
			return tag;
		}

		tag.content = this.content.substring(this.position, closingTagPos);

		if (tagType === ESITagType.CHOOSE || tagType === ESITagType.REMOVE) {
			const childParser = new ESIParser(tag.content);
			tag.children = childParser.parse();
			tag.children?.forEach((child) => {
				child.parent = tag;
			});
		}

		this.position = closingTagPos + closingTag.length;
		return tag;
	}

	private getTagType(tagName: string): ESITagType | null {
		const typeMap: Record<string, ESITagType> = {
			include: ESITagType.INCLUDE,
			remove: ESITagType.REMOVE,
			comment: ESITagType.COMMENT,
			choose: ESITagType.CHOOSE,
			when: ESITagType.WHEN,
			otherwise: ESITagType.OTHERWISE,
			vars: ESITagType.VARS,
		};
		return typeMap[tagName] || null;
	}

	private parseAttributes(tagContent: string): Record<string, string> {
		const attributes: Record<string, string> = {};
		const attrRegex = /([a-z0-9_-]+)=["']([^"']*)["']/gi;
		let match;

		while ((match = attrRegex.exec(tagContent)) !== null) {
			attributes[match[1].toLowerCase()] = match[2];
		}

		return attributes;
	}
}

export function processESI(content: string, context: VCLContext): string {
	if (!content || !context.beresp.do_esi) {
		return content || "";
	}

	let processedContent = content;
	processedContent = processComments(processedContent);
	processedContent = processRemoveTags(processedContent);
	processedContent = processChooseTags(processedContent, context);
	processedContent = processIncludeTags(processedContent, context);

	return processedContent;
}

function _processTag(tag: ESITag, context: VCLContext): string {
	switch (tag.type) {
		case ESITagType.INCLUDE:
			return processIncludeTag(tag, context);
		case ESITagType.REMOVE:
		case ESITagType.COMMENT:
			return "";
		case ESITagType.CHOOSE:
			return processChooseTag(tag, context);
		default:
			return tag.content || "";
	}
}

function processIncludeTag(tag: ESITag, context: VCLContext): string {
	if (!tag.attributes?.src) {
		return "";
	}

	try {
		const includedContent = fetchResource(tag.attributes.src, context);
		return processESI(includedContent, context);
	} catch (error) {
		console.error(`Error processing ESI include: ${error.message}`);
		return "";
	}
}

function processChooseTag(tag: ESITag, context: VCLContext): string {
	if (!tag.children) {
		return "";
	}

	for (const child of tag.children) {
		if (
			child.type === ESITagType.WHEN &&
			evaluateCondition(child.attributes?.test, context)
		) {
			return child.content || "";
		}
		if (child.type === ESITagType.OTHERWISE) {
			return child.content || "";
		}
	}

	return "";
}

function evaluateCondition(
	condition: string | undefined,
	context: VCLContext,
): boolean {
	if (!condition) {
		return false;
	}

	const cookieConditionRegex =
		/\$\(HTTP_COOKIE{([^}]+)}\)\s*==\s*['"]([^'"]+)['"]/;
	const cookieMatch = condition.match(cookieConditionRegex);

	if (cookieMatch) {
		const cookieName = cookieMatch[1];
		const expectedValue = cookieMatch[2];

		if (context.req.http.Cookie) {
			const cookieRegex = new RegExp(`${cookieName}=([^;]+)`);
			const match = context.req.http.Cookie.match(cookieRegex);
			return match ? match[1] === expectedValue : false;
		}
		return false;
	}

	return false;
}

function processComments(content: string): string {
	return content.replace(/<esi:comment[^>]*?(?:\/>|>.*?<\/esi:comment>)/gs, "");
}

function processRemoveTags(content: string): string {
	return content.replace(/<esi:remove>.*?<\/esi:remove>/gs, "");
}

function processChooseTags(content: string, context: VCLContext): string {
	const chooseRegex = /<esi:choose>([\s\S]*?)<\/esi:choose>/g;
	const whenRegex = /<esi:when test="([^"]*)">([\s\S]*?)<\/esi:when>/g;
	const otherwiseRegex = /<esi:otherwise>([\s\S]*?)<\/esi:otherwise>/g;

	return content.replace(chooseRegex, (chooseBlock) => {
		whenRegex.lastIndex = 0;
		let whenMatch;

		while ((whenMatch = whenRegex.exec(chooseBlock)) !== null) {
			if (evaluateCondition(whenMatch[1], context)) {
				return whenMatch[2];
			}
		}

		const otherwiseMatch = otherwiseRegex.exec(chooseBlock);
		return otherwiseMatch ? otherwiseMatch[1] : "";
	});
}

function processIncludeTags(content: string, context: VCLContext): string {
	const includeRegex = /<esi:include\s+src="([^"]*)"(?:\s+[^>]*)?\/>/g;
	return content.replace(includeRegex, (_match, src) =>
		fetchResource(src, context),
	);
}

function fetchResource(url: string, _context: VCLContext): string {
	if (url === "/header") {
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
	if (url === "/footer") {
		return `<footer>
      <p>&copy; 2023 Example Company</p>
    </footer>`;
	}
	return `<!-- ESI include for ${url} -->`;
}
