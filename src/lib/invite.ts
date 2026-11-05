// Builds the "join me" message (pure, unit-tested): the app link, and optionally your friend ID.
export function inviteText(template: string, url: string, idTemplate?: string | null, code?: string | null): string {
  const parts = [template.replace('{url}', url)];
  if (idTemplate && code) parts.push(idTemplate.replace('{code}', code));
  return parts.join('\n\n');
}
