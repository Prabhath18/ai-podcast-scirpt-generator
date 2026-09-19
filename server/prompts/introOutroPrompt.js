import { buildContextBlock } from './outlinePrompt.js';
import { HOOK_STYLES } from '../validators/introOutroSchema.js';

const SPEAKER_RULES = {
  solo: 'There is one host. Write intro_script as a single voice with NO speaker labels.',
  duo: 'There are two hosts. Write intro_script as a conversation where every turn starts on its own line with "Host 1:" or "Host 2:".',
  group:
    'There are three hosts. Write intro_script as a conversation where every turn starts on its own line with "Host 1:", "Host 2:" or "Host 3:".',
};

/** One call that returns hooks in five styles, a full intro script, three outros and a teaser line. */
export function buildIntroOutroPrompt({ topic, tone, podcastName, hostCount = 'solo', lengthMins, outline }) {
  const context = buildContextBlock({ topic, tone, podcastName, hostCount, lengthMins });
  const segmentTitles = outline.segments.map((s, i) => `${i + 1}. ${s.title}`).join('\n');

  return `You are an expert podcast producer writing the opening and closing of one episode.

${context}
Episode title: ${outline.episode_title}
Segments, in order:
${segmentTitles}

${SPEAKER_RULES[hostCount] || SPEAKER_RULES.solo}

Return JSON with:
- hooks: exactly ${HOOK_STYLES.length} opening hooks, one per style, using these exact style labels: ${HOOK_STYLES.join(', ')}. Each is 1 to 3 spoken sentences. For "Statistic", use only a figure you are sure is well established; if you are not sure, write the hook around a "[verify: ...]" placeholder instead of inventing a number.
- intro_script: the full intro that comes AFTER the hook: welcome the listener, frame the episode, and preview what the segments will cover. Do not repeat a hook.
- outros: exactly 3 different closing options, each 2 to 3 sentences with a clear call to action.
- teaser: one short line (under 20 words) that could promote the episode.

Everything must fit "${topic}" and the ${tone} tone. Return ONLY the JSON object, no commentary.`;
}
