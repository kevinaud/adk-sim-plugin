import { noDependencies, sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Sheriff Configuration for ADK Simulator Web UI
 *
 * Enforces module boundaries per the TDD's layered architecture:
 * - features/* can import ui/*, data-access/*, util/*, shared/*
 * - ui/* cannot import data-access/* (presentational components)
 * - data-access/* can import util/*, shared/*
 * - util/* has no dependencies (leaf layer)
 * - shared/* can import util/* only
 *
 * See: mddocs/frontend/research/sheriff-research.md
 */
export const config: SheriffConfig = {
  version: 1,

  // Use barrel-less modules with internal/ encapsulation
  enableBarrelLess: true,

  // Entry point for traversal
  entryFile: './src/main.ts',

  // Module tagging - maps folder structure to tags
  modules: {
    // Environment configuration - accessible by all
    'src/environments': 'type:config',

    'src/app': {
      // Feature modules - one per feature
      'features/<feature>': 'type:feature',

      // UI components - nested by domain
      'ui/<domain>/<component>': ['type:ui', 'domain:<domain>'],
      'ui/<domain>': 'type:ui',

      // Data access layer
      'data-access/<domain>': 'type:data-access',

      // Utilities - no domain, just type
      'util/<lib>': 'type:util',

      // Shared code accessible by all
      'shared/<lib>': 'type:shared',
    },
  },

  // Dependency rules - enforce layered architecture
  depRules: {
    // Root (main.ts, app.config.ts, app.routes.ts) can access features, shared, and data-access
    // Note: root needs data-access to configure DI providers (composition root pattern)
    root: ['type:feature', 'type:shared', 'type:data-access', 'type:config', 'noTag'],

    // Features can access UI, data-access, util, and shared
    'type:feature': ['type:ui', 'type:data-access', 'type:util', 'type:shared', 'type:config', 'noTag'],

    // UI can only access util and shared (no data-access!)
    'type:ui': ['type:util', 'type:shared', 'type:config', 'noTag', sameTag],

    // Data-access can only access util, shared, and config (environment)
    'type:data-access': ['type:util', 'type:shared', 'type:config', 'noTag'],

    // Util has no dependencies (leaf layer)
    'type:util': [noDependencies, 'noTag'],

    // Shared can access util only
    'type:shared': ['type:util', 'noTag'],

    // Config (environments) is a leaf, no dependencies
    'type:config': [noDependencies],

    // Allow noTag modules during migration
    noTag: ['noTag', 'root'],

    // Domain isolation for UI components: can access same domain or untagged
    'domain:event-stream': [sameTag, 'noTag'],
    'domain:control-panel': [sameTag, 'noTag'],
    'domain:shared': [sameTag, 'noTag'],
  },
};
