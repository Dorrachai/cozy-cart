import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  categorizeItem,
  initCategorizerFromData,
  parseItemInput,
  type TaxonomyData,
} from '../categorizer';

describe('Multilingual Open Food Facts + Fuse.js Auto-Categorizer', () => {
  beforeAll(() => {
    const jsonPath = path.resolve(__dirname, '../../../public/data/grocery-taxonomy.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as TaxonomyData;
    initCategorizerFromData(data);
  });

  it('extracts quantities cleanly from natural user typing', () => {
    expect(parseItemInput('2x oat milk')).toEqual({ qty: '2x', name: 'Oat milk' });
    expect(parseItemInput('500g strawberries')).toEqual({ qty: '500g', name: 'Strawberries' });
    expect(parseItemInput('avocados x4')).toEqual({ qty: '4x', name: 'Avocados' });
    expect(parseItemInput('sour gummy bears')).toEqual({ qty: '', name: 'Sour gummy bears' });
  });

  it('auto-sorts English grocery & household items accurately', () => {
    expect(categorizeItem('2x oat milk')).toBe('dairy');
    expect(categorizeItem('cheddar cheese')).toBe('dairy');
    expect(categorizeItem('sour gummy bears')).toBe('candy');
    expect(categorizeItem('dark chocolate')).toBe('candy');
    expect(categorizeItem('fresh strawberries')).toBe('produce');
    expect(categorizeItem('sourdough bread')).toBe('bakery');
    expect(categorizeItem('chicken breast')).toBe('meat');
    expect(categorizeItem('frozen pizza')).toBe('frozen');
    expect(categorizeItem('toilet paper')).toBe('household');
    expect(categorizeItem('toothpaste')).toBe('care');
    expect(categorizeItem('cat litter')).toBe('pets');
  });

  it('auto-sorts Swedish, German, and Spanish items including compound words', () => {
    expect(categorizeItem('havremjölk')).toBe('dairy');
    expect(categorizeItem('chokladmjölk')).toBe('dairy');
    expect(categorizeItem('västerbottensost')).toBe('dairy');
    expect(categorizeItem('lösgodis')).toBe('candy');
    expect(categorizeItem('toalettpapper')).toBe('household');
    expect(categorizeItem('köttfärs')).toBe('meat');
    expect(categorizeItem('vollmilch')).toBe('dairy');
    expect(categorizeItem('gummibärchen')).toBe('candy');
    expect(categorizeItem('leche de avena')).toBe('dairy');
    expect(categorizeItem('aguacate')).toBe('produce');
  });

  it('handles minor typos via Fuse.js and honors household learned overrides', () => {
    expect(categorizeItem('strawberies')).toBe('produce');
    expect(categorizeItem('mystery moon snack')).toBe('other');
    expect(
      categorizeItem('mystery moon snack', { 'mystery moon snack': 'candy' })
    ).toBe('candy');
  });
});
