/** Builds /llms.txt (https://llmstxt.org): H1, blockquote summary, then sections of links. */

export type LlmsLink = { path: string; label: string; description?: string };
export type LlmsSection = { title: string; links: LlmsLink[]; notes?: string[] };
export type LlmsCopy = { summary: string; intro: string; sections: LlmsSection[] };

export function buildLlmsTxt(origin: string, copy: LlmsCopy): string {
  const lines = ['# Casvitta', '', `> ${copy.summary}`, '', copy.intro];
  for (const section of copy.sections) {
    lines.push('', `## ${section.title}`, '');
    for (const { path, label, description } of section.links) {
      lines.push(`- [${label}](${origin}${path})${description ? `: ${description}` : ''}`);
    }
    for (const note of section.notes ?? []) lines.push(`- ${note}`);
  }
  return `${lines.join('\n')}\n`;
}
