import { collectCodex } from './codex.js';
import { collectOllamaCloud } from './ollama-cloud.js';

const COLLECTORS = {
  codex: collectCodex,
  ollama_cloud: collectOllamaCloud,
};

export async function collectProvider(providerId, settings, context) {
  const collector = COLLECTORS[providerId];
  if (!collector) {
    return {
      status: 'unknown_error',
      error: {
        code: 'collector_not_found',
        message: `No collector registered for ${providerId}`,
      },
    };
  }

  return collector(settings || {}, context);
}
