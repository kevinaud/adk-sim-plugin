/**
 * Shared utilities for converter functions.
 *
 * These helpers eliminate repetitive field-by-field mapping code.
 */

/**
 * Copy defined fields from source to target.
 * Only copies fields that are not undefined.
 *
 * @param source - Source object to copy from
 * @param target - Target object to copy to
 * @param fields - Array of field names to copy (uses same name in both)
 */
export function copyDefinedFields<S extends object, T extends object>(
  source: S,
  target: T,
  fields: (keyof S & keyof T)[],
): void {
  for (const field of fields) {
    const value = source[field];
    if (value !== undefined) {
      (target as Record<string, unknown>)[field as string] = value;
    }
  }
}

/**
 * Copy defined fields with name mapping between source and target.
 *
 * @param source - Source object to copy from
 * @param target - Target object to copy to
 * @param mapping - Array of [sourceKey, targetKey] pairs
 */
export function copyMappedFields<S extends object, T extends object>(
  source: S,
  target: T,
  mapping: [keyof S, keyof T][],
): void {
  for (const [srcKey, tgtKey] of mapping) {
    const value = source[srcKey];
    if (value !== undefined) {
      (target as Record<string, unknown>)[tgtKey as string] = value;
    }
  }
}

/**
 * Pick only defined (non-undefined) properties from an object.
 *
 * @param obj - Source object
 * @returns New object with only defined properties
 */
export function pickDefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Create a proto object with $typeName and default values.
 * Merges provided fields on top of defaults.
 *
 * @param typeName - The proto $typeName
 * @param defaults - Default field values
 * @param fields - Provided field values (overrides defaults)
 * @returns Complete proto object
 */
export function createProto<T extends { $typeName: string }>(
  typeName: string,
  defaults: Omit<T, '$typeName'>,
  fields: Partial<Omit<T, '$typeName'>> = {},
): T {
  return {
    $typeName: typeName,
    ...defaults,
    ...pickDefined(fields as object),
  } as T;
}
