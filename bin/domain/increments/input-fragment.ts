/**
 * The Markdown fragment `--input` takes and the terminal interview produces: an optional `# Title`, then `##`
 * sections (and `###` subsections) named like the target document's sections. The same fragment drives the
 * headless and the guided path, so both plan identical edits.
 */
import { hasControls } from '../errors.ts';
import { insistDelivery, type DeliveryErrorCode } from './errors.ts';
import { limits } from './model.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { listItems, outline, sectionBody, sectionContent, type SectionSpan } from './sections.ts';

export interface FragmentSection { name: string; body: string; subsections: { name: string; body: string }[] }
export interface InputFragment { title: string | null; preamble: string; sections: FragmentSection[] }

/** Checks size, control characters and the absence of frontmatter; returns LF text. */
export function inputText(text: string, code: DeliveryErrorCode = 'INCREMENT_INPUT_INVALID', limit: number = limits.fragment): string {
  insistDelivery(text.length <= limit, code, `The input has ${text.length} characters; at most ${limit} are accepted.`);
  insistDelivery(!hasControls(text, true), code, 'The input contains control characters.');
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}
/** The allowed section name for a heading, matched without case; unknown names refuse for either document. */
export function canonicalSection(name: string, allowed: readonly string[]): string {
  const found = allowed.find(item => item.toLowerCase() === name.trim().toLowerCase());
  insistDelivery(found, 'INCREMENT_SECTION_UNKNOWN', `Unknown section "${name}"; use ${allowed.join(', ')}.`, { section: name });
  return found;
}
const trimBlock = (text: string) => text.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');
function section(text: string, span: SectionSpan, allowed: readonly string[]): FragmentSection {
  return { name: canonicalSection(span.name, allowed), body: trimBlock(sectionContent(text, span)),
    subsections: span.subsections.map(sub => ({ name: sub.name, body: trimBlock(sectionBody(text, sub)) })) };
}
/** Splits a fragment into its title, text before the first section, and sections named from `allowed`. */
export function parseInputFragment(raw: string, allowed: readonly string[], code: DeliveryErrorCode = 'INCREMENT_INPUT_INVALID'): InputFragment {
  const text = inputText(raw, code);
  insistDelivery(!parseFrontmatter(text).present, code, 'The input is a Markdown fragment; leave out the --- frontmatter block.');
  const doc = outline(text), first = doc.sections[0]?.headingStart ?? text.length;
  insistDelivery(!doc.title || doc.title.start < first, code, 'Put the # title before the first ## section.');
  const preamble = doc.title ? text.slice(0, doc.title.start) + text.slice(doc.title.next, first) : text.slice(0, first);
  const sections = doc.sections.map(span => section(text, span, allowed));
  const names = sections.map(item => item.name);
  insistDelivery(names.every((name, index) => names.indexOf(name) === index), code, 'Each section appears at most once in the input.');
  return { title: doc.title?.name ?? null, preamble: trimBlock(preamble), sections };
}
/** The fragment section by name (case-insensitive) and an optional subsection. */
export function fragmentBody(fragment: InputFragment, name: string, sub?: string): string | null {
  const found = fragment.sections.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (!found || !sub) return found?.body ?? null;
  return found.subsections.find(item => item.name.toLowerCase() === sub.toLowerCase())?.body ?? null;
}
/** The list items of a fragment body, continuation lines joined. */
export const fragmentItems = (body: string | null): string[] => body ? listItems(body, 0, body.length).map(item => item.full) : [];

export interface FragmentAnswers {
  title?: string; summary?: string; inScope?: string[]; outOfScope?: string[]; tasks?: string[]; documents?: string[];
}
const list = (items: readonly string[] | undefined) => (items ?? []).map(item => item.trim()).filter(Boolean).map(item => `- ${item}`).join('\n');
/** The fragment a headless caller would pipe for the same interview answers. */
export function renderInputFragment(answers: FragmentAnswers): string {
  const scope = [list(answers.inScope) && `### In scope\n\n${list(answers.inScope)}`, list(answers.outOfScope) && `### Out of scope\n\n${list(answers.outOfScope)}`].filter(Boolean).join('\n\n');
  const blocks = [answers.title?.trim() && `# ${answers.title.trim()}`, answers.summary?.trim() && `## Summary\n\n${answers.summary.trim()}`,
    scope && `## Scope\n\n${scope}`, list(answers.tasks) && `## Tasks\n\n${list(answers.tasks)}`, list(answers.documents) && `## Documents\n\n${list(answers.documents)}`];
  const text = blocks.filter(Boolean).join('\n\n');
  return text ? `${text}\n` : '';
}
