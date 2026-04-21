import type { TKey } from '../../i18n/translations';

export type SlashPromptDef = { id: string; labelKey: TKey; textKey: TKey };

/** Keys for i18n — labels are short menu titles, texts are full questions inserted into the chat. */
export const SLASH_PROMPT_DEFS: SlashPromptDef[] = [
  { id: 'pending', labelKey: 'aiSlashP1Label', textKey: 'aiSlashP1Text' },
  { id: 'overdue', labelKey: 'aiSlashP2Label', textKey: 'aiSlashP2Text' },
  { id: 'due-today', labelKey: 'aiSlashP3Label', textKey: 'aiSlashP3Text' },
  { id: 'storehouse', labelKey: 'aiSlashP4Label', textKey: 'aiSlashP4Text' },
  { id: 'orders', labelKey: 'aiSlashP5Label', textKey: 'aiSlashP5Text' },
  { id: 'team', labelKey: 'aiSlashP6Label', textKey: 'aiSlashP6Text' },
  { id: 'users', labelKey: 'aiSlashP7Label', textKey: 'aiSlashP7Text' },
  { id: 'overview', labelKey: 'aiSlashP8Label', textKey: 'aiSlashP8Text' },
];

export const SLASH_PROMPT_DEFS_EMPLOYEE_EXTRA: SlashPromptDef[] = [
  { id: 'emp-supervisor', labelKey: 'aiSlashE1Label', textKey: 'aiSlashE1Text' },
  { id: 'emp-orders-detail', labelKey: 'aiSlashE2Label', textKey: 'aiSlashE2Text' },
  { id: 'emp-priority', labelKey: 'aiSlashE3Label', textKey: 'aiSlashE3Text' },
  { id: 'emp-update-supervisor', labelKey: 'aiSlashE4Label', textKey: 'aiSlashE4Text' },
];

const DEF_MAP: Record<string, SlashPromptDef> = [...SLASH_PROMPT_DEFS, ...SLASH_PROMPT_DEFS_EMPLOYEE_EXTRA].reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<string, SlashPromptDef>,
);

/** Ordered slash command ids per dashboard role (efficient: small lists, no duplicate defs). */
const SLASH_IDS_BY_ROLE: Record<'employee' | 'supervisor' | 'admin', string[]> = {
  employee: [
    'pending',
    'overdue',
    'due-today',
    'storehouse',
    'orders',
    'emp-supervisor',
    'emp-orders-detail',
    'emp-priority',
    'emp-update-supervisor',
    'overview',
  ],
  supervisor: ['pending', 'overdue', 'due-today', 'storehouse', 'orders', 'team', 'overview'],
  admin: ['pending', 'overdue', 'due-today', 'storehouse', 'orders', 'team', 'users', 'overview'],
};

export function slashPromptDefsForRole(role: string | null | undefined): SlashPromptDef[] {
  const r = role === 'employee' || role === 'supervisor' || role === 'admin' ? role : 'admin';
  return SLASH_IDS_BY_ROLE[r].map((id) => DEF_MAP[id]).filter(Boolean);
}

export type SlashMatch = {
  lineStart: number;
  slashStart: number;
  filter: string;
};

export type SlashPromptItem = { id: string; label: string; text: string };

/** Filter prompts by text after `/`; if nothing matches, return all prompts so the user can still pick. */
export function filterSlashPrompts(prompts: SlashPromptItem[], match: SlashMatch | null): SlashPromptItem[] {
  if (!match) return [];
  const q = match.filter.toLowerCase().trim();
  if (!q) return prompts;
  const hit = prompts.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.text.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q),
  );
  return hit.length > 0 ? hit : prompts;
}

/** Returns slash command state when cursor is after `/` on the current line and filter has no spaces. */
export function parseSlashInput(value: string, cursor: number): SlashMatch | null {
  if (cursor < 0) return null;
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
  const lineSeg = value.slice(lineStart, cursor);
  const lastSlash = lineSeg.lastIndexOf('/');
  if (lastSlash === -1) return null;
  const after = lineSeg.slice(lastSlash + 1);
  if (after.includes(' ')) return null;
  return {
    lineStart,
    slashStart: lineStart + lastSlash,
    filter: after,
  };
}
