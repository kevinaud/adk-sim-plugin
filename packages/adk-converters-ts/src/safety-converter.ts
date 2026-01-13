/**
 * Safety Settings Conversion Utilities
 *
 * Converts between proto SafetySetting types and @google/genai SafetySetting types.
 * This includes mapping between proto numeric enums and SDK string enums for
 * HarmCategory and HarmBlockThreshold.
 *
 * Note: Proto enums are numeric, SDK enums are string-based.
 * Unknown enum values are logged as warnings and mapped to UNSPECIFIED.
 */

import type { SafetySetting as ProtoSafetySetting } from '@adk-sim/protos';
import {
  HarmCategory as ProtoHarmCategory,
  SafetySetting_HarmBlockThreshold as ProtoHarmBlockThreshold,
} from '@adk-sim/protos';

import {
  HarmCategory as GenaiHarmCategory,
  HarmBlockThreshold as GenaiHarmBlockThreshold,
} from '@google/genai';

import type { SafetySetting } from '@google/genai';

// Re-export types for consumers
export type { SafetySetting };

// ============================================================================
// Proto → @google/genai Conversion
// ============================================================================

/**
 * Convert a proto SafetySetting to @google/genai SafetySetting.
 *
 * @param protoSafety - The proto SafetySetting message
 * @returns @google/genai SafetySetting object
 *
 * @example
 * ```typescript
 * const safety = protoSafetyToGenaiSafety(protoSafetySetting);
 * console.log(safety.category); // 'HARM_CATEGORY_HARASSMENT'
 * console.log(safety.threshold); // 'BLOCK_MEDIUM_AND_ABOVE'
 * ```
 */
export function protoSafetyToGenaiSafety(protoSafety: ProtoSafetySetting): SafetySetting {
  return {
    category: protoHarmCategoryToGenai(protoSafety.category),
    threshold: protoHarmBlockThresholdToGenai(protoSafety.threshold),
  };
}

/**
 * Convert a proto HarmCategory enum to @google/genai HarmCategory string.
 *
 * Maps numeric proto enum values to their SDK string equivalents.
 * The proto enum uses short names (e.g., HARASSMENT) while SDK uses
 * full names with HARM_CATEGORY_ prefix.
 *
 * @param protoCategory - The proto HarmCategory enum value
 * @returns @google/genai HarmCategory string
 */
export function protoHarmCategoryToGenai(protoCategory: ProtoHarmCategory): GenaiHarmCategory {
  // Map proto numeric enum to SDK string enum
  // Proto uses short names, SDK uses HARM_CATEGORY_ prefix
  const mapping: Record<ProtoHarmCategory, GenaiHarmCategory> = {
    [ProtoHarmCategory.UNSPECIFIED]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
    [ProtoHarmCategory.DEROGATORY]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED, // PaLM-only, map to unspecified
    [ProtoHarmCategory.TOXICITY]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED, // PaLM-only
    [ProtoHarmCategory.VIOLENCE]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED, // PaLM-only
    [ProtoHarmCategory.SEXUAL]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED, // PaLM-only
    [ProtoHarmCategory.MEDICAL]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED, // PaLM-only
    [ProtoHarmCategory.DANGEROUS]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED, // PaLM-only
    [ProtoHarmCategory.HARASSMENT]: GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
    [ProtoHarmCategory.HATE_SPEECH]: GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH,
    [ProtoHarmCategory.SEXUALLY_EXPLICIT]: GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    [ProtoHarmCategory.DANGEROUS_CONTENT]: GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    [ProtoHarmCategory.CIVIC_INTEGRITY]: GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
  };

  const result = mapping[protoCategory];
  if (result === undefined) {
    console.warn(`Unknown proto HarmCategory value: ${protoCategory}, mapping to UNSPECIFIED`);
    return GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED;
  }

  return result;
}

/**
 * Convert a proto HarmBlockThreshold enum to @google/genai HarmBlockThreshold string.
 *
 * @param protoThreshold - The proto HarmBlockThreshold enum value
 * @returns @google/genai HarmBlockThreshold string
 */
export function protoHarmBlockThresholdToGenai(
  protoThreshold: ProtoHarmBlockThreshold
): GenaiHarmBlockThreshold {
  const mapping: Record<ProtoHarmBlockThreshold, GenaiHarmBlockThreshold> = {
    [ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED]:
      GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
    [ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    [ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    [ProtoHarmBlockThreshold.BLOCK_ONLY_HIGH]: GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH,
    [ProtoHarmBlockThreshold.BLOCK_NONE]: GenaiHarmBlockThreshold.BLOCK_NONE,
    [ProtoHarmBlockThreshold.OFF]: GenaiHarmBlockThreshold.OFF,
  };

  const result = mapping[protoThreshold];
  if (result === undefined) {
    console.warn(`Unknown proto HarmBlockThreshold value: ${protoThreshold}, mapping to UNSPECIFIED`);
    return GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED;
  }

  return result;
}

// ============================================================================
// @google/genai → Proto Conversion
// ============================================================================

/**
 * Convert a @google/genai SafetySetting to proto SafetySetting.
 *
 * @param genaiSafety - The @google/genai SafetySetting object
 * @returns Proto SafetySetting object (plain object matching proto structure)
 *
 * @example
 * ```typescript
 * const protoSafety = genaiSafetyToProtoSafety({
 *   category: 'HARM_CATEGORY_HARASSMENT',
 *   threshold: 'BLOCK_MEDIUM_AND_ABOVE'
 * });
 * ```
 */
export function genaiSafetyToProtoSafety(genaiSafety: SafetySetting): ProtoSafetySetting {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.SafetySetting',
    category: genaiHarmCategoryToProto(genaiSafety.category),
    threshold: genaiHarmBlockThresholdToProto(genaiSafety.threshold),
  } as ProtoSafetySetting;
}

/**
 * Convert a @google/genai HarmCategory string to proto HarmCategory enum.
 *
 * @param genaiCategory - The @google/genai HarmCategory string (may be undefined)
 * @returns Proto HarmCategory enum value
 */
export function genaiHarmCategoryToProto(
  genaiCategory: GenaiHarmCategory | undefined
): ProtoHarmCategory {
  if (!genaiCategory) {
    return ProtoHarmCategory.UNSPECIFIED;
  }

  const mapping: Record<GenaiHarmCategory, ProtoHarmCategory> = {
    [GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED]: ProtoHarmCategory.UNSPECIFIED,
    [GenaiHarmCategory.HARM_CATEGORY_HARASSMENT]: ProtoHarmCategory.HARASSMENT,
    [GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH]: ProtoHarmCategory.HATE_SPEECH,
    [GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: ProtoHarmCategory.SEXUALLY_EXPLICIT,
    [GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: ProtoHarmCategory.DANGEROUS_CONTENT,
    [GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY]: ProtoHarmCategory.CIVIC_INTEGRITY,
    // These are image-specific categories that don't have proto equivalents
    [GenaiHarmCategory.HARM_CATEGORY_IMAGE_HATE]: ProtoHarmCategory.UNSPECIFIED,
    [GenaiHarmCategory.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT]: ProtoHarmCategory.UNSPECIFIED,
    [GenaiHarmCategory.HARM_CATEGORY_IMAGE_HARASSMENT]: ProtoHarmCategory.UNSPECIFIED,
    [GenaiHarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT]: ProtoHarmCategory.UNSPECIFIED,
    [GenaiHarmCategory.HARM_CATEGORY_JAILBREAK]: ProtoHarmCategory.UNSPECIFIED,
  };

  const result = mapping[genaiCategory];
  if (result === undefined) {
    console.warn(`Unknown genai HarmCategory value: ${genaiCategory}, mapping to UNSPECIFIED`);
    return ProtoHarmCategory.UNSPECIFIED;
  }

  return result;
}

/**
 * Convert a @google/genai HarmBlockThreshold string to proto HarmBlockThreshold enum.
 *
 * @param genaiThreshold - The @google/genai HarmBlockThreshold string (may be undefined)
 * @returns Proto HarmBlockThreshold enum value
 */
export function genaiHarmBlockThresholdToProto(
  genaiThreshold: GenaiHarmBlockThreshold | undefined
): ProtoHarmBlockThreshold {
  if (!genaiThreshold) {
    return ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED;
  }

  const mapping: Record<GenaiHarmBlockThreshold, ProtoHarmBlockThreshold> = {
    [GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED]:
      ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
    [GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    [GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    [GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH]: ProtoHarmBlockThreshold.BLOCK_ONLY_HIGH,
    [GenaiHarmBlockThreshold.BLOCK_NONE]: ProtoHarmBlockThreshold.BLOCK_NONE,
    [GenaiHarmBlockThreshold.OFF]: ProtoHarmBlockThreshold.OFF,
  };

  const result = mapping[genaiThreshold];
  if (result === undefined) {
    console.warn(`Unknown genai HarmBlockThreshold value: ${genaiThreshold}, mapping to UNSPECIFIED`);
    return ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED;
  }

  return result;
}
