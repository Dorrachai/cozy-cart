import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { initCategorizerFromData, type TaxonomyData } from '../categorizer';
import { exportListAsChecklist, parsePastedChecklist } from '../checklist';
import type { ShoppingList } from '../../types/shopping';

describe('Notes Checklist Copy & Paste Round-Trip', () => {
  beforeAll(() => {
    const jsonPath = path.resolve(__dirname, '../../../public/data/grocery-taxonomy.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as TaxonomyData;
    initCategorizerFromData(data);
  });

  const sampleList: ShoppingList = {
    id: 'l1',
    listCode: 'L-berry-mochi-2345678',
    title: 'Weekend Cabin Grocery Run',
    emoji: '🧺',
    createdAt: 1,
    updatedAt: 1,
    items: {
      a: { id: 'a', name: 'Oat milk', qty: '2x', category: 'dairy', checked: false, updatedAt: 1 },
      b: { id: 'b', name: 'Sour gummies', qty: '', category: 'candy', checked: false, updatedAt: 2 },
      c: { id: 'c', name: 'Bananas', qty: '6', category: 'produce', checked: true, updatedAt: 3 },
    },
  };

  it('exports clean Markdown, Unicode, and Apple Notes / Google Keep checklists', () => {
    const md = exportListAsChecklist(sampleList, {
      format: 'markdown',
      groupByCategory: true,
      includeChecked: true,
    });
    expect(md).toContain('### 🥛 Dairy');
    expect(md).toContain('- [ ] 2x Oat milk');
    expect(md).toContain('- [x] 6 Bananas');

    const plain = exportListAsChecklist(sampleList, {
      format: 'notes-plain',
      groupByCategory: false,
      includeChecked: false,
    });
    // Pure lines for 1-tap Apple Notes / Google Keep checklist conversion
    expect(plain).toBe('2x Oat milk\nSour gummies');
  });

  it('parses pasted checklists from Notes apps and auto-categorizes every item', () => {
    const pasted = `
      ### 🥛 Dairy
      - [ ] 2x Oat milk
      - [x] Butter
      ☐ Lösgodis
      • Toilet paper
      1. 500g Strawberries
    `;

    const items = parsePastedChecklist(pasted);
    expect(items).toEqual([
      { name: 'Oat milk', qty: '2x', checked: false, category: 'dairy' },
      { name: 'Butter', qty: '', checked: true, category: 'dairy' },
      { name: 'Lösgodis', qty: '', checked: false, category: 'candy' },
      { name: 'Toilet paper', qty: '', checked: false, category: 'household' },
      { name: 'Strawberries', qty: '500g', checked: false, category: 'produce' },
    ]);
  });
});
