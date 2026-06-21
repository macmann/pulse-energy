/**
 * Simple model router: inspects the latest user message to decide whether
 * to use the more capable (and slower) gpt-4o or the cheaper gpt-4o-mini.
 */

const COMPLEX_PATTERNS = [
  // Tariff comparison / switching
  /tarif/i,
  /switch|wechsel/i,
  /dynamic\s*vs\.?\s*fixed|fixed\s*vs\.?\s*dynamic/i,
  /compare|comparison|vergleich/i,

  // Simulations & predictions
  /simulat/i,
  /predict|forecast|prognos/i,
  /what.if|was.wäre/i,
  /scenario/i,

  // Multi-step / complex financial analysis
  /how\s+much\s+(would|could|will|can)\s+i\s+save/i,
  /savings?\s+over/i,
  /payback|amortis/i,
  /roi|return\s+on/i,
  /optimal|optimiz|optimis/i,
  /best\s+(time|strategy|approach)/i,

  // Detailed analysis requests
  /analys|analyz/i,
  /breakdown/i,
  /month.by.month|week.by.week|daily\s+pattern/i,
  /§14a|14a\s+enwg|enwg/i,
];

export function selectModel(
  messages: Array<{ role: string; content: string }>,
): string {
  // Find the last user message
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'user');

  if (!lastUserMsg?.content) return 'gpt-4o-mini';

  const text = lastUserMsg.content;

  // Check for complex patterns
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(text)) return 'gpt-4o';
  }

  // Long messages (>150 chars) suggest multi-part questions
  if (text.length > 150) return 'gpt-4o';

  // Default to the smaller, cheaper model
  return 'gpt-4o-mini';
}
