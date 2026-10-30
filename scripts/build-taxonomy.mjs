#!/usr/bin/env node
/**
 * Builds and verifies `public/data/grocery-taxonomy.json` by combining:
 * 1. Distilled multilingual food terms from Open Food Facts' public categories taxonomy
 *    (https://static.openfoodfacts.org/data/taxonomies/categories.json, ODbL)
 *    across English, Swedish, German, Spanish, French, Dutch, Italian, Danish, and Norwegian.
 * 2. Curated everyday supermarket staples + non-food aisles (Household, Personal Care, Pets)
 *    and compound-word suffix rules (e.g. *mjölk, *milch, *milk, *godis, *ost, *käse).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../public/data/grocery-taxonomy.json');
const OFF_URL = 'https://static.openfoodfacts.org/data/taxonomies/categories.json';
const LANGS = ['en', 'sv', 'de', 'es', 'fr', 'nl', 'it', 'da', 'nb'];

/** Curated high-frequency supermarket items & non-food aisles across languages */
const CURATED_TERMS = {
  produce: [
    // English
    'apple', 'apples', 'banana', 'bananas', 'avocado', 'avocados', 'strawberry', 'strawberries',
    'blueberry', 'blueberries', 'raspberry', 'raspberries', 'grapes', 'orange', 'oranges',
    'lemon', 'lemons', 'lime', 'limes', 'mango', 'pear', 'pears', 'peach', 'watermelon', 'melon',
    'kiwi', 'pineapple', 'tomato', 'tomatoes', 'cucumber', 'lettuce', 'spinach', 'arugula',
    'kale', 'broccoli', 'cauliflower', 'carrot', 'carrots', 'potato', 'potatoes', 'sweet potato',
    'onion', 'onions', 'red onion', 'garlic', 'ginger', 'bell pepper', 'peppers', 'chili',
    'zucchini', 'eggplant', 'mushroom', 'mushrooms', 'celery', 'asparagus', 'corn', 'cabbage',
    'green beans', 'peas', 'cilantro', 'parsley', 'basil', 'mint', 'dill', 'chives', 'salad',
    // Swedish
    'äpple', 'äpplen', 'banan', 'bananer', 'avokado', 'jordgubbar', 'blåbär', 'hallon',
    'vindruvor', 'apelsin', 'apelsiner', 'citron', 'citroner', 'päron', 'vattenmelon',
    'tomat', 'tomater', 'körsbärstomater', 'gurka', 'sallad', 'isbergssallad', 'spenat',
    'ruccola', 'broccoli', 'blomkål', 'morot', 'morötter', 'potatis', 'sötpotatis',
    'lök', 'gul lök', 'rödlök', 'salladslök', 'vitlök', 'ingefära', 'paprika', 'squash',
    'aubergine', 'svamp', 'champinjoner', 'selleri', 'sparris', 'vitkål', 'persilja',
    'basilika', 'koriander', 'gräslök', 'frukt', 'grönsaker',
    // German / Spanish / French
    'apfel', 'äpfel', 'banane', 'erdbeeren', 'gurke', 'kartoffeln', 'zwiebel', 'knoblauch',
    'karotten', 'möhren', 'paprika', 'pilze', 'salat', 'zitrone', 'obst', 'gemüse',
    'manzana', 'plátano', 'aguacate', 'fresas', 'tomate', 'pepino', 'lechuga', 'espinaca',
    'zanahoria', 'patatas', 'papas', 'cebolla', 'ajo', 'limón', 'verduras', 'frutas',
    'pomme', 'fraise', 'concombre', 'pommes de terre', 'oignon', 'ail', 'carotte', 'citron'
  ],
  dairy: [
    // English
    'milk', 'oat milk', 'almond milk', 'soy milk', 'whole milk', 'skim milk', 'lactose free milk',
    'butter', 'salted butter', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'halloumi',
    'brie', 'cream cheese', 'cottage cheese', 'ricotta', 'gouda', 'yogurt', 'greek yogurt',
    'yoghurt', 'sour cream', 'heavy cream', 'whipping cream', 'creme fraiche', 'eggs', 'egg',
    'margarine', 'kefir',
    // Swedish
    'mjölk', 'havremjölk', 'mellanmjölk', 'standardmjölk', 'lättmjölk', 'oatly', 'ikaffe',
    'smör', 'bregott', 'margarin', 'ost', 'hushållsost', 'prästost', 'västerbottensost',
    'riven ost', 'färskost', 'keso', 'kvarg', 'fil', 'filmjölk', 'yoghurt', 'turkisk yoghurt',
    'grädde', 'vispgrädde', 'matlagningsgrädde', 'gräddfil', 'crème fraiche', 'ägg',
    // German / Spanish / French
    'milch', 'vollmilch', 'hafermilch', 'käse', 'frischkäse', 'sahne', 'schmand', 'quark',
    'joghurt', 'eier',
    'leche', 'leche de avena', 'mantequilla', 'queso', 'yogur', 'huevos', 'nata',
    'lait', 'beurre', 'fromage', 'yaourt', 'oeufs', 'crème'
  ],
  bakery: [
    'bread', 'sourdough', 'whole wheat bread', 'toast', 'bagel', 'bagels', 'baguette',
    'croissant', 'croissants', 'tortilla', 'tortillas', 'wraps', 'pita', 'naan',
    'hamburger buns', 'hot dog buns', 'buns', 'rolls', 'muffin', 'muffins', 'cinnamon rolls',
    'cake', 'pastry', 'crispbread',
    // Swedish
    'bröd', 'limpa', 'surdegsbröd', 'rostbröd', 'knäckebröd', 'polarbröd', 'frallor',
    'korvbröd', 'hamburgerbröd', 'tortillabröd', 'kanelbullar', 'bullar', 'fikabröd',
    // German / Spanish / French
    'brot', 'brötchen', 'vollkornbrot', 'kuchen',
    'pan', 'pan de molde', 'bollos',
    'pain', 'brioche'
  ],
  meat: [
    'chicken', 'chicken breast', 'chicken thighs', 'ground beef', 'minced meat', 'beef',
    'steak', 'pork', 'pork chops', 'bacon', 'ham', 'turkey', 'sausage', 'sausages', 'hot dogs',
    'meatballs', 'salami', 'prosciutto', 'pepperoni', 'lamb', 'salmon', 'tuna', 'cod',
    'shrimp', 'prawns', 'fish', 'seafood', 'tofu', 'tempeh',
    // Swedish
    'kyckling', 'kycklingfilé', 'köttfärs', 'nötfärs', 'blandfärs', 'fläskfilé', 'fläskkotlett',
    'korv', 'falukorv', 'grillkorv', 'prinskorv', 'köttbullar', 'skinka', 'kalkon',
    'lax', 'laxfilé', 'torsk', 'räkor', 'fisk',
    // German / Spanish / French
    'hähnchen', 'hackfleisch', 'rindfleisch', 'schweinefleisch', 'wurst', 'lachs', 'fisch',
    'pollo', 'carne picada', 'ternera', 'cerdo', 'jamón', 'salchichas', 'salmón', 'pescado',
    'poulet', 'boeuf', 'porc', 'jambon', 'saucisse', 'saumon', 'poisson'
  ],
  frozen: [
    'frozen pizza', 'ice cream', 'popsicle', 'frozen berries', 'frozen peas', 'frozen vegetables',
    'frozen fries', 'french fries', 'fish sticks', 'frozen dumplings', 'sorbet', 'gelato',
    // Swedish
    'fryst pizza', 'billys', 'glass', 'frysta bär', 'frysta ärtor', 'pommes', 'pommes frites',
    'fiskpinnar', 'frysta grönsaker',
    // German / Spanish / French
    'tiefkühlpizza', 'eis', 'pommes', 'tiefkühlgemüse',
    'helado', 'pizza congelada', 'verduras congeladas',
    'glace', 'surgelés'
  ],
  pantry: [
    'pasta', 'spaghetti', 'penne', 'noodles', 'ramen', 'rice', 'jasmine rice', 'basmati rice',
    'quinoa', 'couscous', 'oats', 'oatmeal', 'granola', 'cereal', 'muesli', 'flour', 'sugar',
    'brown sugar', 'powdered sugar', 'baking powder', 'baking soda', 'yeast', 'vanilla',
    'salt', 'black pepper', 'spices', 'cinnamon', 'oregano', 'cumin', 'paprika powder',
    'olive oil', 'vegetable oil', 'vinegar', 'balsamic vinegar', 'soy sauce', 'hot sauce',
    'ketchup', 'mustard', 'mayonnaise', 'mayo', 'pesto', 'tomato sauce', 'crushed tomatoes',
    'tomato paste', 'coconut milk', 'beans', 'black beans', 'chickpeas', 'lentils',
    'peanut butter', 'jam', 'jelly', 'honey', 'maple syrup', 'nutella', 'stock', 'bouillon',
    'soup', 'canned tuna', 'olives', 'pickles', 'taco shells', 'taco seasoning', 'salsa',
    // Swedish
    'makaroner', 'havregryn', 'müsli', 'flingor', 'vetemjöl', 'mjöl', 'socker', 'florsocker',
    'bakpulver', 'jäst', 'vaniljsocker', 'svartpeppar', 'kanel', 'olivolja', 'rapsolja',
    'matolja', 'vinäger', 'soja', 'senap', 'majonnäs', 'krossade tomater', 'tomatpuré',
    'kokosmjölk', 'bönor', 'kikärtor', 'linser', 'jordnötssmör', 'sylt', 'honung',
    'buljong', 'fond', 'oliver', 'saltgurka', 'tacokrydda',
    // German / Spanish / French
    'nudeln', 'reis', 'haferflocken', 'mehl', 'zucker', 'olivenöl', 'senf', 'honig', 'marmelade',
    'arroz', 'harina', 'azúcar', 'aceite de oliva', 'salsa de tomate', 'frijoles', 'lentejas', 'miel',
    'pâtes', 'riz', 'farine', 'sucre', 'huile', 'moutarde', 'confiture'
  ],
  candy: [
    'candy', 'candies', 'sweets', 'gummies', 'gummy bears', 'sour candy', 'sour gummies',
    'licorice', 'chocolate', 'dark chocolate', 'milk chocolate', 'chocolate bar', 'cookies',
    'biscuits', 'oreos', 'brownies', 'chips', 'potato chips', 'crisps', 'tortilla chips',
    'nachos', 'popcorn', 'pretzels', 'crackers', 'nuts', 'almonds', 'cashews', 'peanuts',
    'pistachios', 'walnuts', 'trail mix', 'protein bar', 'granola bar', 'chewing gum', 'mints',
    // Swedish
    'godis', 'lösgodis', 'smågodis', 'lakrits', 'geléhallon', 'bilar', 'ahlgrens bilar',
    'choklad', 'marabou', 'kex', 'kakor', 'ballerina', 'chips', 'ostbågar', 'jordnötter',
    'cashewnötter', 'mandlar', 'nötter', 'tuggummi',
    // German / Spanish / French
    'süßigkeiten', 'gummibärchen', 'schokolade', 'kekse', 'nüsse',
    'dulces', 'caramelos', 'gominolas', 'galletas', 'patatas fritas', 'nueces',
    'bonbons', 'chocolat', 'biscuits', 'noix'
  ],
  drinks: [
    'coffee', 'coffee beans', 'ground coffee', 'espresso', 'tea', 'green tea', 'herbal tea',
    'juice', 'orange juice', 'apple juice', 'smoothie', 'water', 'sparkling water',
    'mineral water', 'soda', 'cola', 'coke', 'pepsi', 'sprite', 'lemonade', 'energy drink',
    'kombucha', 'beer', 'wine', 'red wine', 'white wine', 'cider', 'hot chocolate',
    // Swedish
    'kaffe', 'bryggkaffe', 'kaffebönor', 'te', 'apelsinjuice', 'äppeljuice',
    'vatten', 'kolsyrat vatten', 'ramlösa', 'loka', 'läsk', 'coca cola', 'julmust', 'påskmust',
    'energidryck', 'nocco', 'öl', 'folköl', 'vin', 'saft',
    // German / Spanish / French
    'kaffee', 'tee', 'saft', 'orangensaft', 'wasser', 'mineralwasser', 'bier', 'wein',
    'café', 'té', 'zumo', 'jugo', 'agua', 'refresco', 'cerveza', 'vino',
    'thé', 'jus', 'eau', 'bière', 'vin'
  ],
  household: [
    'toilet paper', 'paper towels', 'kitchen roll', 'tissues', 'napkins', 'dish soap',
    'dishwasher tablets', 'dishwasher pods', 'laundry detergent', 'fabric softener',
    'all purpose cleaner', 'glass cleaner', 'bleach', 'sponges', 'sponge', 'trash bags',
    'garbage bags', 'bin bags', 'ziploc bags', 'freezer bags', 'plastic wrap', 'cling film',
    'aluminum foil', 'tin foil', 'baking paper', 'parchment paper', 'batteries', 'light bulbs',
    'candles', 'matches', 'hand soap',
    // Swedish
    'toalettpapper', 'toapapper', 'hushållspapper', 'servetter', 'näsdukar', 'diskmedel',
    'yes diskmedel', 'diskmaskinstabletter', 'tvättmedel', 'sköljmedel', 'allrengöring',
    'soppåsar', 'avfallspåsar', 'fryspåsar', 'plastfolie', 'aluminiumfolie', 'bakplåtspapper',
    'disktrasa', 'svamp', 'batterier', 'glödlampor', 'ljus', 'värmeljus',
    // German / Spanish / French
    'toilettenpapier', 'klopapier', 'küchenrolle', 'spülmittel', 'waschmittel', 'müllbeutel',
    'papel higiénico', 'servilletas', 'detergente', 'lavavajillas', 'bolsas de basura',
    'papier toilette', 'essuie-tout', 'lessive', 'sac poubelle'
  ],
  care: [
    'shampoo', 'conditioner', 'body wash', 'shower gel', 'soap', 'toothpaste', 'toothbrush',
    'floss', 'mouthwash', 'deodorant', 'lotion', 'moisturizer', 'sunscreen', 'lip balm',
    'razors', 'shaving cream', 'cotton pads', 'q-tips', 'cotton swabs', 'band-aids',
    'painkillers', 'ibuprofen', 'paracetamol', 'vitamins', 'tampons', 'pads', 'diapers',
    'baby wipes', 'wet wipes',
    // Swedish
    'schampo', 'balsam', 'duschkräm', 'tvål', 'handtvål', 'tandkräm', 'tandborste',
    'tandtråd', 'munskölj', 'hudkräm', 'solkräm', 'rakhyvel', 'bomullsrondeller', 'tops',
    'plåster', 'alvedon', 'ipren', 'vitaminer', 'tamponger', 'bindor', 'blöjor', 'våtservetter',
    // German / Spanish / French
    'zahnpasta', 'zahnbürste', 'duschgel', 'seife', 'windeln',
    'champú', 'pasta de dientes', 'jabón', 'desodorante', 'pañales',
    'shampooing', 'dentifrice', 'savon', 'couches'
  ],
  pets: [
    'cat food', 'dog food', 'cat litter', 'dog treats', 'cat treats', 'poop bags', 'bird seed',
    // Swedish
    'kattmat', 'hundmat', 'kattsand', 'hundgodis', 'kattgodis', 'bajspåsar',
    // German / Spanish / French
    'katzenfutter', 'hundefutter', 'katzenstreu',
    'comida para gatos', 'comida para perros', 'arena para gatos',
    'croquettes chat', 'croquettes chien', 'litière'
  ]
};

/** High-precision compound-word suffix rules (handles Nordic/Germanic/English compounds) */
const SUFFIX_RULES = [
  // Dairy
  { suffixes: ['milk', 'mjölk', 'milch', 'cheese', 'ost', 'käse', 'yogurt', 'yoghurt', 'joghurt', 'butter', 'smör', 'grädde', 'fil', 'kvarg'], category: 'dairy' },
  // Bakery
  { suffixes: ['bread', 'bröd', 'brot', 'brötchen', 'bagel', 'croissant', 'muffin', 'bullar', 'limpa', 'tortilla'], category: 'bakery' },
  // Candy & Snacks
  { suffixes: ['candy', 'godis', 'gummies', 'chocolate', 'choklad', 'schokolade', 'chips', 'crisps', 'popcorn', 'cookies', 'kakor', 'kex', 'lakrits', 'nötter'], category: 'candy' },
  // Meat & Seafood
  { suffixes: ['chicken', 'kyckling', 'beef', 'köttfärs', 'nötfärs', 'sausage', 'korv', 'bacon', 'salmon', 'lax', 'shrimp', 'räkor'], category: 'meat' },
  // Produce
  { suffixes: ['berries', 'berry', 'bär', 'salad', 'sallad', 'apple', 'äpple', 'tomato', 'tomat', 'tomater', 'potato', 'potatis', 'lök'], category: 'produce' },
  // Frozen
  { suffixes: ['ice cream', 'glass', 'tiefkühl', 'frozen', 'fryst'], category: 'frozen' },
  // Drinks
  { suffixes: ['juice', 'coffee', 'kaffe', 'soda', 'läsk', 'water', 'vatten', 'wasser', 'beer', 'wine'], category: 'drinks' },
  // Household
  { suffixes: ['detergent', 'tvättmedel', 'diskmedel', 'papper', 'toilet paper', 'trash bags', 'soppåsar', 'batteries', 'batterier'], category: 'household' },
  // Care
  { suffixes: ['shampoo', 'schampo', 'toothpaste', 'tandkräm', 'tvål', 'deodorant', 'blöjor', 'diapers'], category: 'care' },
  // Pets
  { suffixes: ['cat food', 'kattmat', 'dog food', 'hundmat', 'kattsand', 'cat litter'], category: 'pets' }
];

/** Map top-level Open Food Facts parent tags to CozyCart CategoryId */
const OFF_ROOT_MAP = new Map([
  ['en:dairies', 'dairy'],
  ['en:eggs', 'dairy'],
  ['en:cheeses', 'dairy'],
  ['en:butters', 'dairy'],
  ['en:plant-milks', 'dairy'],
  ['en:milks', 'dairy'],
  ['en:yogurts', 'dairy'],
  ['en:fruits', 'produce'],
  ['en:vegetables', 'produce'],
  ['en:fresh-vegetables', 'produce'],
  ['en:fresh-fruits', 'produce'],
  ['en:aromatic-plants', 'produce'],
  ['en:mushrooms', 'produce'],
  ['en:breads', 'bakery'],
  ['en:viennoiseries', 'bakery'],
  ['en:pastries', 'bakery'],
  ['en:meats', 'meat'],
  ['en:meats-and-their-products', 'meat'],
  ['en:poultry', 'meat'],
  ['en:fishes', 'meat'],
  ['en:fishes-and-their-products', 'meat'],
  ['en:seafood', 'meat'],
  ['en:frozen-foods', 'frozen'],
  ['en:ice-creams-and-sorbets', 'frozen'],
  ['en:sweet-snacks', 'candy'],
  ['en:salty-snacks', 'candy'],
  ['en:confectioneries', 'candy'],
  ['en:candies', 'candy'],
  ['en:chocolates', 'candy'],
  ['en:biscuits-and-cakes', 'candy'],
  ['en:chips-and-fries', 'candy'],
  ['en:nuts', 'candy'],
  ['en:beverages', 'drinks'],
  ['en:coffees', 'drinks'],
  ['en:teas', 'drinks'],
  ['en:fruit-juices', 'drinks'],
  ['en:waters', 'drinks'],
  ['en:sodas', 'drinks'],
  ['en:alcoholic-beverages', 'drinks'],
  ['en:pastas', 'pantry'],
  ['en:rices', 'pantry'],
  ['en:flours', 'pantry'],
  ['en:breakfast-cereals', 'pantry'],
  ['en:condiments', 'pantry'],
  ['en:sauces', 'pantry'],
  ['en:spices', 'pantry'],
  ['en:fats', 'pantry'],
  ['en:vegetable-oils', 'pantry'],
  ['en:canned-foods', 'pantry'],
  ['en:jams', 'pantry'],
  ['en:honeys', 'pantry'],
  ['en:legumes', 'pantry']
]);

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveOffCategory(tag, graph, memo = new Map(), visiting = new Set()) {
  if (OFF_ROOT_MAP.has(tag)) return OFF_ROOT_MAP.get(tag);
  if (memo.has(tag)) return memo.get(tag);
  if (visiting.has(tag)) return null;
  visiting.add(tag);

  const node = graph[tag];
  if (!node || !Array.isArray(node.parents)) {
    memo.set(tag, null);
    return null;
  }
  for (const parent of node.parents) {
    if (OFF_ROOT_MAP.has(parent)) {
      const cat = OFF_ROOT_MAP.get(parent);
      memo.set(tag, cat);
      return cat;
    }
  }
  for (const parent of node.parents) {
    const cat = resolveOffCategory(parent, graph, memo, visiting);
    if (cat) {
      memo.set(tag, cat);
      return cat;
    }
  }
  memo.set(tag, null);
  return null;
}

async function fetchOpenFoodFactsTerms() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(OFF_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const graph = await res.json();
    const memo = new Map();
    const extracted = new Map();

    // Only keep short, natural 1-2 word everyday category nouns (skip long technical phrases)
    const bannedWords = /\b(products|based|preparations|substitutes|assortments|unspecified|other|meals|dishes|produits|baserade|produkter|erzeugnisse|zubereitungen|productos|preparados)\b/i;

    for (const [tag, node] of Object.entries(graph)) {
      // Prefer nodes close to well-known food concepts (has wikidata link or direct parent)
      if (!node.wikidata && (!node.parents || node.parents.length === 0)) continue;
      const cat = resolveOffCategory(tag, graph, memo);
      if (!cat || !node.name) continue;

      for (const lang of LANGS) {
        const rawLabel = node.name[lang];
        if (!rawLabel) continue;
        const clean = normalize(rawLabel);
        const words = clean.split(' ');
        if (
          clean.length < 3 ||
          clean.length > 22 ||
          words.length > 2 ||
          bannedWords.test(clean) ||
          /\d/.test(clean)
        ) {
          continue;
        }
        if (!extracted.has(clean)) {
          extracted.set(clean, cat);
        }
      }
    }
    return extracted;
  } catch (err) {
    console.warn(`Open Food Facts live fetch skipped (${err.message}); using curated multilingual seed.`);
    return new Map();
  }
}

async function build() {
  const termToCategory = new Map();

  // 1. Distill Open Food Facts multilingual terms first
  const offTerms = await fetchOpenFoodFactsTerms();
  // Cap OFF additions to ~1,800 crisp high-signal terms so JSON stays ultra-lightweight (<35 KB gzip)
  let offCount = 0;
  for (const [term, cat] of offTerms.entries()) {
    if (offCount >= 1800) break;
    termToCategory.set(term, cat);
    offCount++;
  }

  // 2. Layer curated high-priority everyday grocery & non-food household terms on top (authoritative)
  for (const [cat, words] of Object.entries(CURATED_TERMS)) {
    for (const w of words) {
      termToCategory.set(normalize(w), cat);
    }
  }

  // Group compactly by category -> sorted array of terms
  const byCategory = {};
  for (const [term, cat] of termToCategory.entries()) {
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(term);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort();
  }

  const payload = {
    version: 1,
    source: 'Open Food Facts Taxonomy (ODbL) + CozyCart Multilingual Supermarket Curations',
    suffixes: SUFFIX_RULES,
    categories: byCategory
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  const json = JSON.stringify(payload);
  await fs.writeFile(OUT_PATH, json, 'utf8');

  const gzipBytes = zlib.gzipSync(Buffer.from(json, 'utf8')).length;
  console.log(
    `Built ${OUT_PATH}: ${termToCategory.size} multilingual terms (${(json.length / 1024).toFixed(1)} KB raw, ${(gzipBytes / 1024).toFixed(1)} KB gzipped)`
  );
  if (gzipBytes > 55 * 1024) {
    throw new Error(`Taxonomy gzipped size (${gzipBytes} B) exceeded 55 KB budget!`);
  }
}

async function verify() {
  const raw = await fs.readFile(OUT_PATH, 'utf8');
  const data = JSON.parse(raw);
  const gzipBytes = zlib.gzipSync(Buffer.from(raw, 'utf8')).length;
  const totalTerms = Object.values(data.categories).reduce((acc, arr) => acc + arr.length, 0);

  if (totalTerms < 400) {
    throw new Error(`Expected >= 400 terms in taxonomy, got ${totalTerms}`);
  }
  if (gzipBytes > 55 * 1024) {
    throw new Error(`Taxonomy gzipped size ${gzipBytes} B exceeds 55 KB budget`);
  }
  console.log(`Verified taxonomy OK: ${totalTerms} terms, ${(gzipBytes / 1024).toFixed(1)} KB gzipped.`);
}

if (process.argv.includes('--verify')) {
  verify().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  build().then(verify).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
