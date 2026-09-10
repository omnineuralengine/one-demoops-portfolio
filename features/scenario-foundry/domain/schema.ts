import type { RejectionCategory } from "./types";

export const INPUT_LIMITS = Object.freeze({
  maxDepth: 5,
  maxNodes: 120,
  maxArrayItems: 12,
  maxObjectKeys: 24,
  maxStringCharacters: 120,
});

export const FORBIDDEN_STRUCTURE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

export function inspectUnknownStructure(value: unknown): readonly RejectionCategory[] {
  const categories = new Set<RejectionCategory>();
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > INPUT_LIMITS.maxNodes || current.depth > INPUT_LIMITS.maxDepth) {
      categories.add("STRUCTURE_LIMIT");
      break;
    }
    if (typeof current.value === "string") {
      if (current.value.length > INPUT_LIMITS.maxStringCharacters) {
        categories.add("STRUCTURE_LIMIT");
        continue;
      }
      detectUnsafeString(current.value, categories);
      continue;
    }
    if (current.value === null || ["boolean", "number", "undefined"].includes(typeof current.value)) continue;
    if (typeof current.value !== "object") {
      categories.add("UNRECOGNIZED_STRUCTURE");
      continue;
    }
    let isArray: boolean;
    let prototype: object | null;
    let descriptors: Record<PropertyKey, PropertyDescriptor>;
    let ownKeys: readonly PropertyKey[];
    let arrayLength: number | null = null;
    try {
      isArray = Array.isArray(current.value);
      prototype = Object.getPrototypeOf(current.value);
      if (isArray) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current.value, "length");
        arrayLength = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value as number : null;
        if (prototype !== Array.prototype || typeof arrayLength !== "number" || !Number.isSafeInteger(arrayLength) || arrayLength < 0) {
          categories.add("PROTOTYPE_OR_EXOTIC_OBJECT");
          continue;
        }
        // Reject from the single bounded length descriptor before enumerating a hostile
        // or oversized array. This keeps the firewall's work bounded by policy.
        if (arrayLength > INPUT_LIMITS.maxArrayItems) {
          categories.add("STRUCTURE_LIMIT");
          continue;
        }
      }
      ownKeys = Reflect.ownKeys(current.value);
      const maximumKeys = isArray ? INPUT_LIMITS.maxArrayItems + 1 : INPUT_LIMITS.maxObjectKeys;
      if (ownKeys.length > maximumKeys) {
        categories.add("STRUCTURE_LIMIT");
        continue;
      }
      descriptors = Object.getOwnPropertyDescriptors(current.value);
    } catch {
      categories.add("PROTOTYPE_OR_EXOTIC_OBJECT");
      continue;
    }
    const isFile = typeof File !== "undefined" && prototype === File.prototype;
    const isBlob = typeof Blob !== "undefined" && prototype === Blob.prototype;
    if (isFile || isBlob) {
      categories.add("FILE_UPLOAD");
      continue;
    }
    if (isArray) {
      const length = arrayLength!;
      const expectedKeys = Array.from({ length }, (_, index) => String(index));
      if (ownKeys.some((key) => typeof key !== "string")
        || ownKeys.length !== expectedKeys.length + 1
        || !ownKeys.every((key) => key === "length" || expectedKeys.includes(key as string))
        || expectedKeys.some((key) => {
          const descriptor = descriptors[key];
          return !descriptor || descriptor.get || descriptor.set || !("value" in descriptor) || !descriptor.enumerable;
        })) {
        categories.add("PROTOTYPE_OR_EXOTIC_OBJECT");
        continue;
      }
      for (const key of expectedKeys) stack.push({ value: descriptors[key].value, depth: current.depth + 1 });
      continue;
    }
    if (prototype !== Object.prototype && prototype !== null) {
      categories.add("PROTOTYPE_OR_EXOTIC_OBJECT");
      continue;
    }
    if (ownKeys.some((key) => typeof key !== "string")) {
      categories.add("PROTOTYPE_OR_EXOTIC_OBJECT");
      continue;
    }
    for (const key of ownKeys as readonly string[]) {
      const descriptor = descriptors[key];
      if (FORBIDDEN_STRUCTURE_KEYS.has(key) || descriptor.get || descriptor.set || !("value" in descriptor)) {
        categories.add("PROTOTYPE_OR_EXOTIC_OBJECT");
        continue;
      }
      if (key.length > INPUT_LIMITS.maxStringCharacters) {
        categories.add("STRUCTURE_LIMIT");
        continue;
      }
      detectUnsafeKey(key, categories);
      stack.push({ value: descriptor.value, depth: current.depth + 1 });
    }
  }
  return [...categories].sort();
}

function detectUnsafeKey(key: string, categories: Set<RejectionCategory>) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/(token|secret|password|credential|cookie|authorization|connectionstring|oauth)/.test(normalized)) categories.add("CREDENTIAL_OR_CONNECTION");
  if (/^(email|phone|address|street|salesforceid|record|records|rows|rawrecords|salesforceexport|attachment|attachments|transcript|transcripts|note|notes|description|descriptions)$/.test(normalized)) categories.add("CUSTOMER_METADATA");
  if (/(customfield|formula|metadata|label)/.test(normalized)) categories.add("CUSTOMER_METADATA");
  if (/(companyname|personname|customername|accountname|contactname)/.test(normalized)) categories.add("PERSON_OR_COMPANY_NAME");
  if (/(exactvalue|amount|revenue|count|date)/.test(normalized) && normalized !== "expiration") categories.add("EXACT_COMMERCIAL_VALUE");
}

function detectUnsafeString(value: string, categories: Set<RejectionCategory>) {
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) categories.add("PHONE_OR_EMAIL");
  if (/(?:\+?\d[\d ().-]{7,}\d)/.test(value)) categories.add("PHONE_OR_EMAIL");
  if (/\b\d{1,6}\s+[A-Za-z][A-Za-z .'-]+\s(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln)\b/i.test(value)) categories.add("ADDRESS");
  if (/\b[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?\b/.test(value)) categories.add("IDENTIFIER");
  if (/(?:https?:\/\/|postgres(?:ql)?:\/\/|salesforce:\/\/|Bearer\s+|sk-[A-Za-z0-9]|authorization\s*:|BEGIN [A-Z ]*PRIVATE KEY)/i.test(value)) categories.add("CREDENTIAL_OR_CONNECTION");
  if (/<\/?(?:script|iframe|object|embed|style|img)\b|javascript:|ignore (?:all|previous) instructions|system prompt/i.test(value)) categories.add("FREE_TEXT_OR_INSTRUCTION");
}

export function hasExactKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  try {
    const keys = Reflect.ownKeys(record);
    if (keys.length !== allowed.length) return false;
    const descriptors = Object.getOwnPropertyDescriptors(record);
    return keys.every((key) => typeof key === "string" && allowed.includes(key))
      && allowed.every((key) => descriptors[key]?.enumerable === true);
  } catch {
    return false;
  }
}

export function isExactUtcIso(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isUniqueEnumArray<T extends string>(value: unknown, allowed: readonly T[], minimum = 1): value is T[] {
  return Array.isArray(value)
    && value.length >= minimum
    && value.length <= INPUT_LIMITS.maxArrayItems
    && new Set(value).size === value.length
    && value.every((item) => typeof item === "string" && allowed.includes(item as T));
}

export interface PlainDataLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxArrayItems: number;
  readonly maxObjectKeys: number;
  readonly maxStringCharacters: number;
}

/** Safely proves that an externally supplied value is bounded accessor-free JSON data. */
export function isBoundedPlainData(value: unknown, limits: PlainDataLimits): boolean {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  const seen = new Set<object>();
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > limits.maxNodes || current.depth > limits.maxDepth) return false;
    if (typeof current.value === "string") {
      if (current.value.length > limits.maxStringCharacters) return false;
      continue;
    }
    if (current.value === null || typeof current.value === "boolean") continue;
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) return false;
      continue;
    }
    if (typeof current.value !== "object" || seen.has(current.value)) return false;
    seen.add(current.value);

    let prototype: object | null;
    let isArray: boolean;
    try {
      prototype = Object.getPrototypeOf(current.value);
      isArray = Array.isArray(current.value);
    } catch {
      return false;
    }
    if (isArray) {
      let lengthDescriptor: PropertyDescriptor | undefined;
      try { lengthDescriptor = Object.getOwnPropertyDescriptor(current.value, "length"); }
      catch { return false; }
      const length = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : null;
      if (prototype !== Array.prototype || typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > limits.maxArrayItems) return false;
    } else if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }

    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(current.value);
    } catch {
      return false;
    }
    const dataKeys = isArray ? keys.filter((key) => key !== "length") : keys;
    if (dataKeys.length > (isArray ? limits.maxArrayItems : limits.maxObjectKeys)
      || dataKeys.some((key) => typeof key !== "string" || key.length > limits.maxStringCharacters || FORBIDDEN_STRUCTURE_KEYS.has(key))) return false;
    if (isArray && dataKeys.some((key, index) => key !== String(index))) return false;
    let descriptors: Record<PropertyKey, PropertyDescriptor>;
    try {
      descriptors = Object.getOwnPropertyDescriptors(current.value);
    } catch {
      return false;
    }
    for (const key of dataKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get || descriptor.set || !("value" in descriptor) || !descriptor.enumerable) return false;
      stack.push({ value: descriptor.value, depth: current.depth + 1 });
    }
  }
  return true;
}
