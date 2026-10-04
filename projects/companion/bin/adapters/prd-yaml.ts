import { prdFrontmatter, typedPrd, type PrdMarkdown } from '../domain/prd-markdown.ts';
import { requireSketch } from '../domain/errors.ts';
/** The pinned library parses inert YAML only. No custom tags, JavaScript constructors or network access. */
export async function parsePrdMarkdown(markdown: string, filename: string): Promise<PrdMarkdown | null> {
  const header = prdFrontmatter(markdown,filename);
  if (header === null) return null;
  const { parseDocument } = await import('yaml');
  const document = parseDocument(header,{ strict:true,uniqueKeys:true,prettyErrors:false,version:'1.2',schema:'core',resolveKnownTags:false });
  requireSketch(document.errors.length === 0 && document.warnings.length === 0,'PRD_FRONTMATTER','Malformed or unsupported YAML frontmatter: '+filename);
  let metadata: unknown;
  try { metadata = document.toJS({ mapAsMap:true,maxAliasCount:50 }); }
  catch { requireSketch(false,'PRD_FRONTMATTER','YAML aliases exceed the supported safe expansion limit: '+filename); }
  requireSketch(metadata instanceof Map,'PRD_FRONTMATTER','Frontmatter must be a YAML mapping: '+filename);
  return typedPrd(markdown,filename,Object.fromEntries(['type','id','title'].filter(key=>metadata.has(key)).map(key=>[key,metadata.get(key)])));
}
