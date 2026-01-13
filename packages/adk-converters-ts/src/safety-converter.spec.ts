/**
 * Tests for Safety Settings Conversion Utilities
 *
 * Tests cover:
 * - Proto → Genai conversion for all HarmCategory values
 * - Proto → Genai conversion for all HarmBlockThreshold values
 * - Genai → Proto conversion for all HarmCategory values
 * - Genai → Proto conversion for all HarmBlockThreshold values
 * - Full SafetySetting round-trip conversion
 * - Unknown enum value handling (mapped to UNSPECIFIED with warning)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import {
  protoSafetyToGenaiSafety,
  genaiSafetyToProtoSafety,
  protoHarmCategoryToGenai,
  genaiHarmCategoryToProto,
  protoHarmBlockThresholdToGenai,
  genaiHarmBlockThresholdToProto,
} from './safety-converter.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a proto SafetySetting for testing.
 */
function createProtoSafetySetting(
  category: ProtoHarmCategory,
  threshold: ProtoHarmBlockThreshold
): ProtoSafetySetting {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.SafetySetting',
    category,
    threshold,
  } as ProtoSafetySetting;
}

/**
 * Create a genai SafetySetting for testing.
 */
function createGenaiSafetySetting(
  category: GenaiHarmCategory,
  threshold: GenaiHarmBlockThreshold
): SafetySetting {
  return {
    category,
    threshold,
  };
}

// ============================================================================
// Proto → Genai: HarmCategory Tests
// ============================================================================

describe('Safety Conversion', () => {
  describe('protoHarmCategoryToGenai', () => {
    it('should convert UNSPECIFIED', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.UNSPECIFIED);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED);
    });

    it('should convert HARASSMENT', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.HARASSMENT);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_HARASSMENT);
    });

    it('should convert HATE_SPEECH', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.HATE_SPEECH);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH);
    });

    it('should convert SEXUALLY_EXPLICIT', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.SEXUALLY_EXPLICIT);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT);
    });

    it('should convert DANGEROUS_CONTENT', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.DANGEROUS_CONTENT);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT);
    });

    it('should convert CIVIC_INTEGRITY', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.CIVIC_INTEGRITY);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY);
    });

    // PaLM-only categories should map to UNSPECIFIED
    it('should convert PaLM-only DEROGATORY to UNSPECIFIED', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.DEROGATORY);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED);
    });

    it('should convert PaLM-only TOXICITY to UNSPECIFIED', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.TOXICITY);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED);
    });

    it('should convert PaLM-only VIOLENCE to UNSPECIFIED', () => {
      const result = protoHarmCategoryToGenai(ProtoHarmCategory.VIOLENCE);
      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED);
    });
  });

  // ============================================================================
  // Proto → Genai: HarmBlockThreshold Tests
  // ============================================================================

  describe('protoHarmBlockThresholdToGenai', () => {
    it('should convert HARM_BLOCK_THRESHOLD_UNSPECIFIED', () => {
      const result = protoHarmBlockThresholdToGenai(
        ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED
      );
      expect(result).toBe(GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED);
    });

    it('should convert BLOCK_LOW_AND_ABOVE', () => {
      const result = protoHarmBlockThresholdToGenai(ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE);
      expect(result).toBe(GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE);
    });

    it('should convert BLOCK_MEDIUM_AND_ABOVE', () => {
      const result = protoHarmBlockThresholdToGenai(ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
      expect(result).toBe(GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
    });

    it('should convert BLOCK_ONLY_HIGH', () => {
      const result = protoHarmBlockThresholdToGenai(ProtoHarmBlockThreshold.BLOCK_ONLY_HIGH);
      expect(result).toBe(GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH);
    });

    it('should convert BLOCK_NONE', () => {
      const result = protoHarmBlockThresholdToGenai(ProtoHarmBlockThreshold.BLOCK_NONE);
      expect(result).toBe(GenaiHarmBlockThreshold.BLOCK_NONE);
    });

    it('should convert OFF', () => {
      const result = protoHarmBlockThresholdToGenai(ProtoHarmBlockThreshold.OFF);
      expect(result).toBe(GenaiHarmBlockThreshold.OFF);
    });
  });

  // ============================================================================
  // Genai → Proto: HarmCategory Tests
  // ============================================================================

  describe('genaiHarmCategoryToProto', () => {
    it('should convert HARM_CATEGORY_UNSPECIFIED', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED);
      expect(result).toBe(ProtoHarmCategory.UNSPECIFIED);
    });

    it('should convert HARM_CATEGORY_HARASSMENT', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_HARASSMENT);
      expect(result).toBe(ProtoHarmCategory.HARASSMENT);
    });

    it('should convert HARM_CATEGORY_HATE_SPEECH', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH);
      expect(result).toBe(ProtoHarmCategory.HATE_SPEECH);
    });

    it('should convert HARM_CATEGORY_SEXUALLY_EXPLICIT', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT);
      expect(result).toBe(ProtoHarmCategory.SEXUALLY_EXPLICIT);
    });

    it('should convert HARM_CATEGORY_DANGEROUS_CONTENT', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT);
      expect(result).toBe(ProtoHarmCategory.DANGEROUS_CONTENT);
    });

    it('should convert HARM_CATEGORY_CIVIC_INTEGRITY', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY);
      expect(result).toBe(ProtoHarmCategory.CIVIC_INTEGRITY);
    });

    it('should convert undefined to UNSPECIFIED', () => {
      const result = genaiHarmCategoryToProto(undefined);
      expect(result).toBe(ProtoHarmCategory.UNSPECIFIED);
    });

    // Image-specific categories should map to UNSPECIFIED
    it('should convert IMAGE_HATE to UNSPECIFIED', () => {
      const result = genaiHarmCategoryToProto(GenaiHarmCategory.HARM_CATEGORY_IMAGE_HATE);
      expect(result).toBe(ProtoHarmCategory.UNSPECIFIED);
    });
  });

  // ============================================================================
  // Genai → Proto: HarmBlockThreshold Tests
  // ============================================================================

  describe('genaiHarmBlockThresholdToProto', () => {
    it('should convert HARM_BLOCK_THRESHOLD_UNSPECIFIED', () => {
      const result = genaiHarmBlockThresholdToProto(
        GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED
      );
      expect(result).toBe(ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED);
    });

    it('should convert BLOCK_LOW_AND_ABOVE', () => {
      const result = genaiHarmBlockThresholdToProto(GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE);
      expect(result).toBe(ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE);
    });

    it('should convert BLOCK_MEDIUM_AND_ABOVE', () => {
      const result = genaiHarmBlockThresholdToProto(GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
      expect(result).toBe(ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
    });

    it('should convert BLOCK_ONLY_HIGH', () => {
      const result = genaiHarmBlockThresholdToProto(GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH);
      expect(result).toBe(ProtoHarmBlockThreshold.BLOCK_ONLY_HIGH);
    });

    it('should convert BLOCK_NONE', () => {
      const result = genaiHarmBlockThresholdToProto(GenaiHarmBlockThreshold.BLOCK_NONE);
      expect(result).toBe(ProtoHarmBlockThreshold.BLOCK_NONE);
    });

    it('should convert OFF', () => {
      const result = genaiHarmBlockThresholdToProto(GenaiHarmBlockThreshold.OFF);
      expect(result).toBe(ProtoHarmBlockThreshold.OFF);
    });

    it('should convert undefined to UNSPECIFIED', () => {
      const result = genaiHarmBlockThresholdToProto(undefined);
      expect(result).toBe(ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED);
    });
  });

  // ============================================================================
  // Full SafetySetting Conversion Tests
  // ============================================================================

  describe('protoSafetyToGenaiSafety', () => {
    it('should convert full SafetySetting with HARASSMENT and BLOCK_MEDIUM_AND_ABOVE', () => {
      const protoSafety = createProtoSafetySetting(
        ProtoHarmCategory.HARASSMENT,
        ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      );

      const result = protoSafetyToGenaiSafety(protoSafety);

      expect(result.category).toBe(GenaiHarmCategory.HARM_CATEGORY_HARASSMENT);
      expect(result.threshold).toBe(GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
    });

    it('should convert SafetySetting with DANGEROUS_CONTENT and BLOCK_NONE', () => {
      const protoSafety = createProtoSafetySetting(
        ProtoHarmCategory.DANGEROUS_CONTENT,
        ProtoHarmBlockThreshold.BLOCK_NONE
      );

      const result = protoSafetyToGenaiSafety(protoSafety);

      expect(result.category).toBe(GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT);
      expect(result.threshold).toBe(GenaiHarmBlockThreshold.BLOCK_NONE);
    });

    it('should convert SafetySetting with SEXUALLY_EXPLICIT and OFF', () => {
      const protoSafety = createProtoSafetySetting(
        ProtoHarmCategory.SEXUALLY_EXPLICIT,
        ProtoHarmBlockThreshold.OFF
      );

      const result = protoSafetyToGenaiSafety(protoSafety);

      expect(result.category).toBe(GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT);
      expect(result.threshold).toBe(GenaiHarmBlockThreshold.OFF);
    });
  });

  describe('genaiSafetyToProtoSafety', () => {
    it('should convert full SafetySetting with HARASSMENT and BLOCK_MEDIUM_AND_ABOVE', () => {
      const genaiSafety = createGenaiSafetySetting(
        GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
        GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      );

      const result = genaiSafetyToProtoSafety(genaiSafety);

      expect(result.category).toBe(ProtoHarmCategory.HARASSMENT);
      expect(result.threshold).toBe(ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
    });

    it('should convert SafetySetting with HATE_SPEECH and BLOCK_LOW_AND_ABOVE', () => {
      const genaiSafety = createGenaiSafetySetting(
        GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH,
        GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE
      );

      const result = genaiSafetyToProtoSafety(genaiSafety);

      expect(result.category).toBe(ProtoHarmCategory.HATE_SPEECH);
      expect(result.threshold).toBe(ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE);
    });

    it('should include $typeName in result', () => {
      const genaiSafety = createGenaiSafetySetting(
        GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
        GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      );

      const result = genaiSafetyToProtoSafety(genaiSafety);

      expect(result.$typeName).toBe('google.ai.generativelanguage.v1beta.SafetySetting');
    });
  });

  // ============================================================================
  // Round-trip Conversion Tests
  // ============================================================================

  describe('Round-trip conversion', () => {
    it('should preserve HARASSMENT category through round-trip', () => {
      const original = createGenaiSafetySetting(
        GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
        GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      );

      const toProto = genaiSafetyToProtoSafety(original);
      const backToGenai = protoSafetyToGenaiSafety(toProto);

      expect(backToGenai.category).toBe(original.category);
      expect(backToGenai.threshold).toBe(original.threshold);
    });

    it('should preserve all Gemini categories through round-trip', () => {
      const categories: GenaiHarmCategory[] = [
        GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
        GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH,
        GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
      ];

      for (const category of categories) {
        const original = createGenaiSafetySetting(
          category,
          GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        );

        const toProto = genaiSafetyToProtoSafety(original);
        const backToGenai = protoSafetyToGenaiSafety(toProto);

        expect(backToGenai.category).toBe(original.category);
      }
    });

    it('should preserve all thresholds through round-trip', () => {
      const thresholds: GenaiHarmBlockThreshold[] = [
        GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
        GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH,
        GenaiHarmBlockThreshold.BLOCK_NONE,
        GenaiHarmBlockThreshold.OFF,
      ];

      for (const threshold of thresholds) {
        const original = createGenaiSafetySetting(
          GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold
        );

        const toProto = genaiSafetyToProtoSafety(original);
        const backToGenai = protoSafetyToGenaiSafety(toProto);

        expect(backToGenai.threshold).toBe(original.threshold);
      }
    });
  });

  // ============================================================================
  // Unknown Enum Value Tests
  // ============================================================================

  describe('Unknown enum value handling', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should log warning and return UNSPECIFIED for unknown proto HarmCategory', () => {
      // Cast an invalid number to the enum type to simulate unknown value
      const unknownCategory = 999 as ProtoHarmCategory;

      const result = protoHarmCategoryToGenai(unknownCategory);

      expect(result).toBe(GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown proto HarmCategory')
      );
    });

    it('should log warning and return UNSPECIFIED for unknown proto HarmBlockThreshold', () => {
      const unknownThreshold = 999 as ProtoHarmBlockThreshold;

      const result = protoHarmBlockThresholdToGenai(unknownThreshold);

      expect(result).toBe(GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown proto HarmBlockThreshold')
      );
    });

    it('should log warning and return UNSPECIFIED for unknown genai HarmCategory', () => {
      const unknownCategory = 'HARM_CATEGORY_UNKNOWN' as GenaiHarmCategory;

      const result = genaiHarmCategoryToProto(unknownCategory);

      expect(result).toBe(ProtoHarmCategory.UNSPECIFIED);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown genai HarmCategory')
      );
    });

    it('should log warning and return UNSPECIFIED for unknown genai HarmBlockThreshold', () => {
      const unknownThreshold = 'UNKNOWN_THRESHOLD' as GenaiHarmBlockThreshold;

      const result = genaiHarmBlockThresholdToProto(unknownThreshold);

      expect(result).toBe(ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown genai HarmBlockThreshold')
      );
    });
  });
});
