import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapDisplayLayout, sitemapOutline, SITEMAP_CARD } from '../companion/sitemap/layout.ts';

const node = (id, parent = null, position = null) => ({ id, parent, position });
function noOverlaps(positions) {
  const entries = Object.entries(positions);
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const [a, first] = entries[i], [b, second] = entries[j];
    assert.ok(Math.abs(first.x - second.x) >= SITEMAP_CARD.width ||
      Math.abs(first.y - second.y) >= SITEMAP_CARD.height, `${a} overlaps ${b}`);
  }
}
test('self-project-shaped wide hierarchy lays out every card without collisions', () => {
  const nodes = [...Array.from({ length: 5 }, (_, i) => node('root-' + i)),
    ...Array.from({ length: 23 }, (_, i) => node('child-' + i, 'root-0'))];
  const before = structuredClone(nodes), positions = sitemapDisplayLayout(nodes);
  assert.equal(Object.keys(positions).length, 28); noOverlaps(positions);
  assert.deepEqual(sitemapDisplayLayout(nodes), positions); assert.deepEqual(nodes, before);
});
test('maximum-width and deep hierarchies reserve enough rows', () => {
  const wide = Array.from({ length: 60 }, (_, i) => node('n' + i, i ? 'n0' : null));
  const deep = Array.from({ length: 40 }, (_, i) => node('n' + i, i ? 'n' + (i - 1) : null));
  noOverlaps(sitemapDisplayLayout(wide)); noOverlaps(sitemapDisplayLayout(deep));
  assert.equal(Object.keys(sitemapDisplayLayout(wide)).length, 60);
});
test('saved positions survive, while unsaved cards avoid the occupied area', () => {
  const nodes = [node('saved', null, { x: 32, y: 32 }), node('new'), node('child', 'new')];
  const positions = sitemapDisplayLayout(nodes);
  assert.deepEqual(positions.saved, nodes[0].position); noOverlaps(positions);
  positions.saved.x = 999; assert.equal(nodes[0].position.x, 32);
});
test('explicit arrangement replaces overlapping geometry without mutating its input', () => {
  const nodes = [node('one', null, { x: -40, y: -40 }), node('two', 'one', { x: -40, y: -40 })];
  const before = structuredClone(nodes);
  assert.deepEqual(sitemapDisplayLayout(nodes).one, { x: -40, y: -40 });
  noOverlaps(sitemapDisplayLayout(nodes, false)); assert.deepEqual(nodes, before);
});
test('stable outline is pre-order even when children precede their parent in storage', () => {
  const nodes = [node('child', 'root'), node('other'), node('root'), node('grandchild', 'child')];
  assert.deepEqual(sitemapOutline(nodes), [{ id: 'other', depth: 0 }, { id: 'root', depth: 0 },
    { id: 'child', depth: 1 }, { id: 'grandchild', depth: 2 }]);
  assert.deepEqual(sitemapDisplayLayout([]), {}); assert.deepEqual(sitemapOutline([]), []);
});
test('invalid hierarchy and non-finite positions fail before layout', () => {
  for (const nodes of [[node('same'), node('same')], [node('lost', 'missing')],
    [node('a', 'b'), node('b', 'a')], [node('a', null, { x: NaN, y: 0 })],
    Array.from({ length: 61 }, (_, i) => node('n' + i))]) {
    assert.throws(() => sitemapDisplayLayout(nodes)); assert.throws(() => sitemapOutline(nodes));
  }
});
