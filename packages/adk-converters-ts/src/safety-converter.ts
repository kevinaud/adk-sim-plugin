/**
 * Safety Settings Conversion Utilities
 *
 * Converts between proto SafetySetting types and @google/genai SafetySetting types.
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

export type { SafetySetting };

// ============================================================================
// Enum Mappings
// ============================================================================

const PROTO_TO_GENAI_HARM_CATEGORY: Record<ProtoHarmCategory, GenaiHarmCategory> = {
  [ProtoHarmCategory.UNSPECIFIED]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.DEROGATORY]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.TOXICITY]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.VIOLENCE]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.SEXUAL]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.MEDICAL]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.DANGEROUS]: GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED,
  [ProtoHarmCategory.HARASSMENT]: GenaiHarmCategory.HARM_CATEGORY_HARASSMENT,
  [ProtoHarmCategory.HATE_SPEECH]: GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH,
  [ProtoHarmCategory.SEXUALLY_EXPLICIT]: GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  [ProtoHarmCategory.DANGEROUS_CONTENT]: GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  [ProtoHarmCategory.CIVIC_INTEGRITY]: GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
};

const GENAI_TO_PROTO_HARM_CATEGORY: Record<GenaiHarmCategory, ProtoHarmCategory> = {
  [GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED]: ProtoHarmCategory.UNSPECIFIED,
  [GenaiHarmCategory.HARM_CATEGORY_HARASSMENT]: ProtoHarmCategory.HARASSMENT,
  [GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH]: ProtoHarmCategory.HATE_SPEECH,
  [GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: ProtoHarmCategory.SEXUALLY_EXPLICIT,
  [GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: ProtoHarmCategory.DANGEROUS_CONTENT,
  [GenaiHarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY]: ProtoHarmCategory.CIVIC_INTEGRITY,
  [GenaiHarmCategory.HARM_CATEGORY_IMAGE_HATE]: ProtoHarmCategory.UNSPECIFIED,
  [GenaiHarmCategory.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT]: ProtoHarmCategory.UNSPECIFIED,
  [GenaiHarmCategory.HARM_CATEGORY_IMAGE_HARASSMENT]: ProtoHarmCategory.UNSPECIFIED,
  [GenaiHarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT]: ProtoHarmCategory.UNSPECIFIED,
  [GenaiHarmCategory.HARM_CATEGORY_JAILBREAK]: ProtoHarmCategory.UNSPECIFIED,
};

const PROTO_TO_GENAI_THRESHOLD: Record<ProtoHarmBlockThreshold, GenaiHarmBlockThreshold> = {
  [ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED]:
    GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
  [ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  [ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  [ProtoHarmBlockThreshold.BLOCK_ONLY_HIGH]: GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH,
  [ProtoHarmBlockThreshold.BLOCK_NONE]: GenaiHarmBlockThreshold.BLOCK_NONE,
  [ProtoHarmBlockThreshold.OFF]: GenaiHarmBlockThreshold.OFF,
};

const GENAI_TO_PROTO_THRESHOLD: Record<GenaiHarmBlockThreshold, ProtoHarmBlockThreshold> = {
  [GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED]:
    ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
  [GenaiHarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: ProtoHarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  [GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: ProtoHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  [GenaiHarmBlockThreshold.BLOCK_ONLY_HIGH]: ProtoHarmBlockThreshold.BLOCK_ONLY_HIGH,
  [GenaiHarmBlockThreshold.BLOCK_NONE]: ProtoHarmBlockThreshold.BLOCK_NONE,
  [GenaiHarmBlockThreshold.OFF]: ProtoHarmBlockThreshold.OFF,
};

// ============================================================================
// Conversion Functions
// ============================================================================

export function protoSafetyToGenaiSafety(proto: ProtoSafetySetting): SafetySetting {
  return {
    category: protoHarmCategoryToGenai(proto.category),
    threshold: protoHarmBlockThresholdToGenai(proto.threshold),
  };
}

export function genaiSafetyToProtoSafety(genai: SafetySetting): ProtoSafetySetting {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.SafetySetting',
    category: genaiHarmCategoryToProto(genai.category),
    threshold: genaiHarmBlockThresholdToProto(genai.threshold),
  } as ProtoSafetySetting;
}

export function protoHarmCategoryToGenai(proto: ProtoHarmCategory): GenaiHarmCategory {
  return PROTO_TO_GENAI_HARM_CATEGORY[proto] ?? GenaiHarmCategory.HARM_CATEGORY_UNSPECIFIED;
}

export function genaiHarmCategoryToProto(genai: GenaiHarmCategory | undefined): ProtoHarmCategory {
  if (!genai) return ProtoHarmCategory.UNSPECIFIED;
  return GENAI_TO_PROTO_HARM_CATEGORY[genai] ?? ProtoHarmCategory.UNSPECIFIED;
}

export function protoHarmBlockThresholdToGenai(
  proto: ProtoHarmBlockThreshold,
): GenaiHarmBlockThreshold {
  return (
    PROTO_TO_GENAI_THRESHOLD[proto] ?? GenaiHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED
  );
}

export function genaiHarmBlockThresholdToProto(
  genai: GenaiHarmBlockThreshold | undefined,
): ProtoHarmBlockThreshold {
  if (!genai) return ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED;
  return (
    GENAI_TO_PROTO_THRESHOLD[genai] ?? ProtoHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED
  );
}
