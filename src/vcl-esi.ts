/**
 * VCL ESI (Edge Side Includes) Module
 *
 * This module provides functionality to parse and process ESI tags in HTML content.
 * It implements the basic ESI specification as supported by Fastly VCL.
 */

import {VCLContext} from './vcl';
import {fetchResource} from './vcl-fetch';

/**
 * ESI Tag Types
 */
export enum ESITagType {
  INCLUDE = 'include',
  REMOVE = 'remove',
  COMMENT = 'comment',
  CHOOSE = 'choose',
  WHEN = 'when',
  OTHERWISE = 'otherwise',
  VARS = 'vars'
}

/**
 * ESI Tag Interface
 */
export interface ESITag {
  type: ESITagType;
  content?: string;
  attributes?: Record<string, string>;
  children?: ESITag[];
  parent?: ESITag;
}

/**
 * ESI Parser Class
 *
 * Parses HTML content and extracts ESI tags
 */
export class ESIParser {
  private content: string;
  private position: number = 0;
  private tags: ESITag[] = [];

  constructor(content: string) {
    this.content = content;
  }

  /**
   * Parse the content and extract ESI tags
   *
   * @returns Array of ESI tags
   */
  parse(): ESITag[] {
    this.position = 0;
    this.tags = [];

    while (this.position < this.content.length) {
      const tagStart = this.content.indexOf('<esi:', this.position);

      if (tagStart === -1) {
        break;
      }

      // Move position to the start of the tag
      this.position = tagStart;

      // Parse the tag
      const tag = this.parseTag();
      if (tag) {
        this.tags.push(tag);
      }
    }

    return this.tags;
  }

  /**
   * Parse a single ESI tag
   *
   * @returns The parsed ESI tag or null if invalid
   */
  private parseTag(): ESITag | null {
    // Find the tag name
    const tagNameMatch = this.content.substring(this.position).match(/<esi:([a-z]+)/i);
    if (!tagNameMatch) {
      this.position++;
      return null;
    }

    const tagName = tagNameMatch[1].toLowerCase();
    let tagType: ESITagType;

    // Map the tag name to an ESI tag type
    switch (tagName) {
      case 'include':
        tagType = ESITagType.INCLUDE;
        break;
      case 'remove':
        tagType = ESITagType.REMOVE;
        break;
      case 'comment':
        tagType = ESITagType.COMMENT;
        break;
      case 'choose':
        tagType = ESITagType.CHOOSE;
        break;
      case 'when':
        tagType = ESITagType.WHEN;
        break;
      case 'otherwise':
        tagType = ESITagType.OTHERWISE;
        break;
      case 'vars':
        tagType = ESITagType.VARS;
        break;
      default:
        // Unknown tag type
        this.position++;
        return null;
    }

    // Find the end of the opening tag
    const tagEndPos = this.content.indexOf('>', this.position);
    if (tagEndPos === -1) {
      this.position++;
      return null;
    }

    // Extract the tag content
    const tagContent = this.content.substring(this.position, tagEndPos + 1);

    // Parse attributes
    const attributes = this.parseAttributes(tagContent);

    // Create the tag object
    const tag: ESITag = {
      type: tagType,
      attributes
    };

    // Move position past the opening tag
    this.position = tagEndPos + 1;

    // Handle self-closing tags
    if (tagContent.endsWith('/>')) {
      return tag;
    }

    // Handle tags with content
    const closingTag = `</esi:${ tagName }>`;
    const closingTagPos = this.content.indexOf(closingTag, this.position);

    if (closingTagPos === -1) {
      // No closing tag found, treat as self-closing
      return tag;
    }

    // Extract the content between tags
    tag.content = this.content.substring(this.position, closingTagPos);

    // Parse child tags for container elements
    if (tagType === ESITagType.CHOOSE || tagType === ESITagType.REMOVE) {
      const childParser = new ESIParser(tag.content);
      tag.children = childParser.parse();

      // Set parent reference for children
      if (tag.children) {
        tag.children.forEach(child => {
          child.parent = tag;
        });
      }
    }

    // Move position past the closing tag
    this.position = closingTagPos + closingTag.length;

    return tag;
  }

  /**
   * Parse attributes from a tag string
   *
   * @param tagContent The tag content string
   * @returns Object containing attribute name-value pairs
   */
  private parseAttributes(tagContent: string): Record<string, string> {
    const attributes: Record<string, string> = {};

    // Regular expression to match attributes
    // Matches name="value" or name='value' patterns
    const attrRegex = /([a-z0-9_\-]+)=["']([^"']*)["']/gi;
    let match;

    while ((match = attrRegex.exec(tagContent)) !== null) {
      const name = match[1].toLowerCase();
      const value = match[2];
      attributes[name] = value;
    }

    return attributes;
  }
}

/**
 * Process ESI tags in HTML content
 *
 * @param content The HTML content to process
 * @param context The VCL context
 * @returns The processed HTML content with ESI tags resolved
 */
export function processESI(content: string, context: VCLContext): string {
  if (!content) {
    return '';
  }

  // Check if ESI processing is enabled
  if (!context.beresp.do_esi) {
    return content;
  }

  // Process different types of ESI tags
  let processedContent = content;

  // Process ESI comments first (simplest)
  processedContent = processComments(processedContent);

  // Process ESI remove tags
  processedContent = processRemoveTags(processedContent);

  // Process ESI choose/when/otherwise tags
  processedContent = processChooseTags(processedContent, context);

  // Process ESI include tags (may contain nested ESI tags)
  processedContent = processIncludeTags(processedContent, context);

  return processedContent;
}

/**
 * Process a single ESI tag
 *
 * @param tag The ESI tag to process
 * @param context The VCL context
 * @returns The processed content to replace the tag
 */
function processTag(tag: ESITag, context: VCLContext): string {
  switch (tag.type) {
    case ESITagType.INCLUDE:
      return processIncludeTag(tag, context);
    case ESITagType.REMOVE:
      return ''; // Remove the content
    case ESITagType.COMMENT:
      return ''; // Remove comments
    case ESITagType.CHOOSE:
      return processChooseTag(tag, context);
    default:
      return tag.content || '';
  }
}

/**
 * Process an ESI include tag
 *
 * @param tag The ESI include tag
 * @param context The VCL context
 * @returns The included content
 */
function processIncludeTag(tag: ESITag, context: VCLContext): string {
  if (!tag.attributes || !tag.attributes.src) {
    return ''; // No src attribute
  }

  try {
    // Fetch the included content
    const includedContent = fetchResource(tag.attributes.src, context);

    // Process ESI tags in the included content (recursive)
    return processESI(includedContent, context);
  } catch (error) {
    console.error(`Error processing ESI include: ${ error.message }`);
    return ''; // Return empty string on error
  }
}

/**
 * Process an ESI choose tag
 *
 * @param tag The ESI choose tag
 * @param context The VCL context
 * @returns The content of the matching when or otherwise tag
 */
function processChooseTag(tag: ESITag, context: VCLContext): string {
  if (!tag.children) {
    return '';
  }

  // Find the first matching when tag or the otherwise tag
  for (const child of tag.children) {
    if (child.type === ESITagType.WHEN) {
      if (evaluateCondition(child.attributes?.test, context)) {
        return child.content || '';
      }
    } else if (child.type === ESITagType.OTHERWISE) {
      return child.content || '';
    }
  }

  return ''; // No matching condition
}

/**
 * Evaluate an ESI condition
 *
 * @param condition The condition to evaluate
 * @param context The VCL context
 * @returns True if the condition is true, false otherwise
 */
function evaluateCondition(condition: string | undefined, context: VCLContext): boolean {
  if (!condition) {
    return false;
  }

  // Handle cookie conditions: $(HTTP_COOKIE{name}) == 'value'
  const cookieConditionRegex = /\$\(HTTP_COOKIE{([^}]+)}\)\s*==\s*['"]([^'"]+)['"]/;
  const cookieMatch = condition.match(cookieConditionRegex);

  if (cookieMatch) {
    const cookieName = cookieMatch[1];
    const expectedValue = cookieMatch[2];

    if (context.req.http.Cookie) {
      // Extract cookie value
      const cookieRegex = new RegExp(`${ cookieName }=([^;]+)`);
      const match = context.req.http.Cookie.match(cookieRegex);

      if (match) {
        return match[1] === expectedValue;
      }
    }

    return false;
  }

  // Add more condition types as needed

  return false;
}

/**
 * Process ESI comment tags
 *
 * @param content The HTML content to process
 * @returns The processed content with comments removed
 */
function processComments(content: string): string {
  // Match both self-closing and regular comment tags
  const commentRegex = /<esi:comment[^>]*?(?:\/>|>.*?<\/esi:comment>)/gs;
  return content.replace(commentRegex, '');
}

/**
 * Process ESI remove tags
 *
 * @param content The HTML content to process
 * @returns The processed content with remove sections removed
 */
function processRemoveTags(content: string): string {
  // Match remove tags and their content
  const removeRegex = /<esi:remove>.*?<\/esi:remove>/gs;
  return content.replace(removeRegex, '');
}

/**
 * Process ESI choose/when/otherwise tags
 *
 * @param content The HTML content to process
 * @param context The VCL context
 * @returns The processed content with choose sections evaluated
 */
function processChooseTags(content: string, context: VCLContext): string {
  let processedContent = content;

  // Find all choose blocks
  const chooseRegex = /<esi:choose>([\s\S]*?)<\/esi:choose>/g;
  const whenRegex = /<esi:when test="([^"]*)">([\s\S]*?)<\/esi:when>/g;
  const otherwiseRegex = /<esi:otherwise>([\s\S]*?)<\/esi:otherwise>/g;

  // Process each choose block
  processedContent = processedContent.replace(chooseRegex, (chooseBlock) => {
    // Try to find a matching when condition
    let whenMatch;
    let matched = false;
    let result = '';

    // Reset the regex state for each choose block
    whenRegex.lastIndex = 0;

    while ((whenMatch = whenRegex.exec(chooseBlock)) !== null && !matched) {
      const condition = whenMatch[1];
      const content = whenMatch[2];

      if (evaluateCondition(condition, context)) {
        result = content;
        matched = true;
      }
    }

    // If no when condition matched, use the otherwise content
    if (!matched) {
      const otherwiseMatch = otherwiseRegex.exec(chooseBlock);
      if (otherwiseMatch) {
        result = otherwiseMatch[1];
      }
    }

    return result;
  });

  return processedContent;
}

/**
 * Process ESI include tags
 *
 * @param content The HTML content to process
 * @param context The VCL context
 * @returns The processed content with includes resolved
 */
function processIncludeTags(content: string, context: VCLContext): string {
  // Match include tags
  const includeRegex = /<esi:include\s+src="([^"]*)"(?:\s+[^>]*)?\/>/g;

  return content.replace(includeRegex, (match, src) => {
    return fetchResource(src, context);
  });
}

/**
 * Evaluate an ESI condition
 *
 * @param condition The condition to evaluate
 * @param context The VCL context
 * @returns True if the condition is true, false otherwise
 */
function evaluateCondition(condition: string | undefined, context: VCLContext): boolean {
  if (!condition) {
    return false;
  }

  // Handle cookie conditions: $(HTTP_COOKIE{name}) == 'value'
  const cookieConditionRegex = /\$\(HTTP_COOKIE{([^}]+)}\)\s*==\s*['"]([^'"]+)['"]/;
  const cookieMatch = condition.match(cookieConditionRegex);

  if (cookieMatch) {
    const cookieName = cookieMatch[1];
    const expectedValue = cookieMatch[2];

    if (context.req.http.Cookie) {
      // Extract cookie value
      const cookieRegex = new RegExp(`${ cookieName }=([^;]+)`);
      const match = context.req.http.Cookie.match(cookieRegex);

      if (match) {
        return match[1] === expectedValue;
      }
    }

    return false;
  }

  // Add more condition types as needed

  return false;
}

/**
 * Fetch a resource from a URL or path
 *
 * @param url The URL or path to fetch
 * @param context The VCL context
 * @returns The fetched content
 */
function fetchResource(url: string, context: VCLContext): string {
  // Mock implementation for testing
  if (url === '/header') {
    return `<header>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    </header>`;
  } else if (url === '/footer') {
    return `<footer>
      <p>&copy; 2023 Example Company</p>
    </footer>`;
  }

  // Default placeholder
  return `<!-- ESI include for ${ url } -->`;
}
