import { describe, expect, it } from 'vitest';
import { mergeHouseholdIndexes, mergeLists } from '../crdt';
import type { HouseholdIndex, ShoppingList } from '../../types/shopping';

describe('LWW-Element-Set CRDT merging', () => {
  it('preserves concurrent item additions, check-offs, and custom list renames across partners', () => {
    const baseList: ShoppingList = {
      id: 'list-1',
      listCode: 'L-berry-mint-2345678',
      title: 'October List',
      emoji: '🛒',
      createdAt: 1000,
      updatedAt: 1000,
      items: {
        milk: {
          id: 'milk',
          name: 'Oat milk',
          qty: '2x',
          category: 'dairy',
          checked: false,
          updatedAt: 1000,
        },
      },
    };

    // Partner A checks off Milk and renames list to a completely custom name
    const partnerA: ShoppingList = {
      ...baseList,
      title: 'Cabin Weekend Trip 🌲',
      emoji: '🌲',
      updatedAt: 2000,
      items: {
        ...baseList.items,
        milk: { ...baseList.items.milk!, checked: true, updatedAt: 2000 },
      },
    };

    // Partner B concurrently adds Sour Gummies without knowing Partner A checked Milk
    const partnerB: ShoppingList = {
      ...baseList,
      updatedAt: 1500,
      items: {
        ...baseList.items,
        candy: {
          id: 'candy',
          name: 'Sour gummies',
          qty: '1 bag',
          category: 'candy',
          checked: false,
          updatedAt: 1800,
        },
      },
    };

    const mergedAB = mergeLists(partnerA, partnerB, 3000);
    const mergedBA = mergeLists(partnerB, partnerA, 3000);

    // Commutative convergence!
    expect(mergedAB).toEqual(mergedBA);
    expect(mergedAB.title).toBe('Cabin Weekend Trip 🌲');
    expect(mergedAB.items.milk?.checked).toBe(true);
    expect(mergedAB.items.candy?.name).toBe('Sour gummies');
  });

  it('merges household custom list indexes and learned category overrides', () => {
    const hA: HouseholdIndex = {
      version: 1,
      householdName: 'Our Home',
      updatedAt: 100,
      lists: {
        l1: {
          id: 'l1',
          listCode: 'L-apple-oat-2345678',
          title: 'Monthly Staples',
          emoji: '🥛',
          createdAt: 50,
          updatedAt: 100,
        },
      },
      learnedCategories: { oatly: 'dairy' },
    };

    const hB: HouseholdIndex = {
      version: 1,
      householdName: 'Theo & Partner',
      updatedAt: 200,
      lists: {
        l2: {
          id: 'l2',
          listCode: 'L-peach-fig-3456789',
          title: 'Taco Friday!',
          emoji: '🌮',
          createdAt: 150,
          updatedAt: 200,
        },
      },
      learnedCategories: { marabou: 'candy' },
    };

    const merged = mergeHouseholdIndexes(hA, hB, 300);
    expect(merged.householdName).toBe('Theo & Partner');
    expect(Object.keys(merged.lists).sort()).toEqual(['l1', 'l2']);
    expect(merged.learnedCategories).toEqual({ oatly: 'dairy', marabou: 'candy' });
  });
});
