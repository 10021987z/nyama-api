import { Injectable } from '@nestjs/common';
import { SuggestMenuDto } from './dto/suggest-menu.dto';

export interface MenuSuggestion {
  name: string;
  description: string;
  suggestedPriceXaf: number;
  allergens: string[];
  preparationTimeMin: number;
  category: string;
  matchedDish: string | null;
}

interface DishTemplate {
  keys: string[];
  name: string;
  description: string;
  priceXaf: number;
  prepTimeMin: number;
  allergens: string[];
  category: 'entree' | 'plat' | 'dessert' | 'boisson';
}

// Dictionnaire culinaire camerounais. Les clés doivent être en minuscules, sans accents.
// L'ordre compte : les entrées les plus spécifiques doivent venir AVANT les plus génériques
// (ex: "poulet dg" avant "poulet"), car on prend le premier match.
const CAMEROONIAN_DISHES: DishTemplate[] = [
  // ─── Plats traditionnels iconiques ─────────────────────────
  {
    keys: ['ndole'],
    name: 'Ndolé traditionnel',
    description:
      "Plat emblématique camerounais aux feuilles de ndolé amères mijotées dans une sauce onctueuse à l'arachide, relevée d'épices locales. Servi avec plantain mûr, miondo ou riz blanc.",
    priceXaf: 2500,
    prepTimeMin: 35,
    allergens: ['arachide', 'poisson'],
    category: 'plat',
  },
  {
    keys: ['eru'],
    name: 'Eru aux feuilles de waterfleaf',
    description:
      "Plat typique du Sud-Ouest mêlant feuilles d'eru finement hachées et waterfleaf, mijotées avec viande, poisson fumé et peau de bœuf. Accompagné de water fufu ou de garri.",
    priceXaf: 2500,
    prepTimeMin: 40,
    allergens: ['poisson', 'crustaces'],
    category: 'plat',
  },
  {
    keys: ['koki'],
    name: 'Koki aux haricots de Bafia',
    description:
      "Spécialité camerounaise à base de haricots niébés écrasés, aromatisés à l'huile de palme et au piment, cuits à la vapeur dans des feuilles de bananier. Servi tiède avec plantain.",
    priceXaf: 1500,
    prepTimeMin: 30,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['poulet dg', 'dg'],
    name: 'Poulet DG maison',
    description:
      'Le plat chic de la cuisine camerounaise : poulet sauté aux plantains mûrs, poivrons multicolores et carottes, relevé d\'ail, gingembre et herbes fraîches. Sauce parfumée et généreuse.',
    priceXaf: 3500,
    prepTimeMin: 35,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['okok', 'osang'],
    name: 'Okok aux feuilles de gnetum',
    description:
      "Plat Beti à base de feuilles de gnetum finement coupées, mijotées avec écorces d'arbre, arachide et viande ou poisson fumé. Servi avec bâton de manioc.",
    priceXaf: 2000,
    prepTimeMin: 45,
    allergens: ['arachide'],
    category: 'plat',
  },
  {
    keys: ['mbongo', 'tchobi'],
    name: "Mbongo Tchobi à l'épice noire",
    description:
      "Sauce noire profonde du pays Bassa, préparée avec l'épice mbongo pilée, gingembre et piment, accompagnant viande ou poisson. Servi avec plantain ou miondo.",
    priceXaf: 2500,
    prepTimeMin: 40,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['kondre'],
    name: 'Kondre de plantain aux épices',
    description:
      'Ragoût Bamiléké de plantain vert mijoté avec viande de chèvre ou bœuf, tomate, oignon et épices du terroir. Plat de fête généreux et parfumé.',
    priceXaf: 2500,
    prepTimeMin: 45,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['sangah', 'sanga'],
    name: 'Sangah au maïs frais',
    description:
      "Plat traditionnel du Centre à base de maïs frais pilé et feuilles de manioc, cuit avec huile de palme et poisson fumé. Texture fondante et goût rustique.",
    priceXaf: 2000,
    prepTimeMin: 50,
    allergens: ['poisson'],
    category: 'plat',
  },
  {
    keys: ['poisson braise', 'poisson braisé'],
    name: 'Poisson braisé à la braise',
    description:
      'Poisson frais (bar ou capitaine) mariné au citron, ail et piment, grillé au feu de bois. Servi avec miondo ou plantain mûr et sauce tomate-oignon fraîche.',
    priceXaf: 3000,
    prepTimeMin: 25,
    allergens: ['poisson'],
    category: 'plat',
  },
  {
    keys: ['poulet braise', 'poulet braisé', 'poulet grille'],
    name: 'Poulet braisé façon Douala',
    description:
      "Demi-poulet mariné aux épices camerounaises, grillé lentement au charbon pour une chair tendre et une peau croustillante. Accompagné de sauce arachide et plantain.",
    priceXaf: 3000,
    prepTimeMin: 30,
    allergens: ['arachide'],
    category: 'plat',
  },
  {
    keys: ['suya'],
    name: 'Suya de bœuf pimenté',
    description:
      "Brochettes de bœuf marinées au yaji (mélange d'arachide, gingembre et piment) puis grillées à la braise. Servi avec tomate et oignon cru.",
    priceXaf: 1500,
    prepTimeMin: 15,
    allergens: ['arachide'],
    category: 'plat',
  },
  {
    keys: ['pepe soup', 'pepper soup', 'pep soup'],
    name: 'Pepper soup épicée',
    description:
      "Bouillon relevé aux épices africaines, poisson ou viande, piment rouge et herbes aromatiques. Chaud, parfumé et réconfortant.",
    priceXaf: 2000,
    prepTimeMin: 25,
    allergens: ['poisson'],
    category: 'plat',
  },
  {
    keys: ['achu'],
    name: 'Achu à la soupe jaune',
    description:
      "Plat iconique du Nord-Ouest : pâte de taro lisse arrosée de soupe jaune (huile de palme, kanwa et épices), accompagnée de viande, peau de bœuf et poisson fumé.",
    priceXaf: 3000,
    prepTimeMin: 60,
    allergens: ['poisson'],
    category: 'plat',
  },
  {
    keys: ['kwacoco', 'kwa coco'],
    name: 'Kwacoco Bible',
    description:
      "Spécialité Sawa : pâte de macabo râpé à l'huile de palme, agrémentée de crevettes, poisson fumé et feuilles de bananier. Servi chaud, texture fondante.",
    priceXaf: 2500,
    prepTimeMin: 50,
    allergens: ['poisson', 'crustaces'],
    category: 'plat',
  },
  {
    keys: ['taro'],
    name: 'Taro sauce jaune',
    description:
      "Tubercule de taro cuit à la vapeur puis écrasé, servi avec une sauce jaune parfumée à l'huile de palme et au kanwa. Plat roboratif du grassfield.",
    priceXaf: 2000,
    prepTimeMin: 45,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['bobolo', 'miondo'],
    name: 'Bobolo / Miondo artisanal',
    description:
      'Bâton de manioc fermenté puis cuit dans des feuilles de marantacée. Accompagnement authentique des plats camerounais, texture ferme et goût légèrement acidulé.',
    priceXaf: 500,
    prepTimeMin: 10,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['plantain', 'makala'],
    name: 'Plantain mûr frit',
    description:
      'Plantains mûrs coupés en rondelles et frits à l\'huile, croustillants dehors et fondants dedans. Accompagnement sucré-salé idéal.',
    priceXaf: 800,
    prepTimeMin: 10,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['beignet haricot', 'beignet-haricot', 'accra'],
    name: 'Beignets haricots maison',
    description:
      'Beignets dorés de niébé parfumés aux épices, croustillants à l\'extérieur et moelleux à l\'intérieur. Servi chaud avec bouillie ou sauce pimentée.',
    priceXaf: 500,
    prepTimeMin: 15,
    allergens: ['gluten'],
    category: 'entree',
  },
  {
    keys: ['bouillie', 'pap'],
    name: 'Bouillie de maïs traditionnelle',
    description:
      'Bouillie onctueuse de maïs fermenté, légèrement sucrée, parfumée à la muscade ou au gingembre. Petit-déjeuner typique camerounais.',
    priceXaf: 500,
    prepTimeMin: 15,
    allergens: ['lait'],
    category: 'entree',
  },
  {
    keys: ['soya', 'soja'],
    name: 'Soya épicé',
    description:
      "Fines tranches de bœuf marinées aux épices africaines et grillées, servies avec piment et oignon cru. Street food incontournable.",
    priceXaf: 1000,
    prepTimeMin: 15,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['riz sauce'],
    name: "Riz sauce graine",
    description:
      "Riz parfumé nappé d'une sauce graine de palme onctueuse à la viande ou au poisson fumé, relevée au piment. Généreux et savoureux.",
    priceXaf: 2000,
    prepTimeMin: 40,
    allergens: ['poisson'],
    category: 'plat',
  },
  {
    keys: ['riz gras'],
    name: 'Riz gras tomate',
    description:
      "Riz cuit à la tomate fraîche, oignon, ail et herbes du jardin, agrémenté de légumes et viande braisée. Parfum doux et couleur rouge-orangée.",
    priceXaf: 1800,
    prepTimeMin: 35,
    allergens: [],
    category: 'plat',
  },
  {
    keys: ['spaghetti'],
    name: 'Spaghetti sauce tomate camerounaise',
    description:
      'Spaghettis cuits al dente nappés d\'une sauce tomate maison relevée aux herbes fraîches, piment doux et morceaux de viande ou poisson.',
    priceXaf: 1500,
    prepTimeMin: 25,
    allergens: ['gluten'],
    category: 'plat',
  },
  {
    keys: ['chocobi', 'chawarma', 'shawarma'],
    name: 'Chawarma du jour',
    description:
      'Galette de blé garnie de viande grillée, crudités fraîches et sauce crémeuse aillée. Street food urbaine généreuse.',
    priceXaf: 2000,
    prepTimeMin: 15,
    allergens: ['gluten', 'lait'],
    category: 'plat',
  },
  // ─── Boissons ─────────────────────────────────────
  {
    keys: ['bissap', 'foleré'],
    name: 'Bissap glacé maison',
    description:
      "Infusion de fleurs d'hibiscus aromatisée menthe et gingembre, servie bien fraîche. Désaltérant et délicatement acidulé.",
    priceXaf: 500,
    prepTimeMin: 5,
    allergens: [],
    category: 'boisson',
  },
  {
    keys: ['gingembre', 'jus gingembre'],
    name: 'Jus de gingembre frais',
    description:
      "Jus artisanal de gingembre frais pressé, citron et un soupçon de sucre de canne. Piquant, tonique et vitaminé.",
    priceXaf: 500,
    prepTimeMin: 5,
    allergens: [],
    category: 'boisson',
  },
  {
    keys: ['jus tamarin'],
    name: 'Jus de tamarin',
    description:
      'Jus rafraîchissant à base de pulpe de tamarin, légèrement sucré et acidulé. Parfait pour accompagner les plats épicés.',
    priceXaf: 500,
    prepTimeMin: 5,
    allergens: [],
    category: 'boisson',
  },
];

// Protéines / ingrédients principaux détectables dans les mots-clés
const PROTEIN_HINTS: Record<string, string> = {
  poulet: 'poulet tendre',
  boeuf: 'bœuf mijoté',
  bœuf: 'bœuf mijoté',
  viande: 'viande tendre',
  porc: 'porc caramélisé',
  chevre: 'chèvre fondante',
  chèvre: 'chèvre fondante',
  poisson: 'poisson fumé',
  crevette: 'crevettes',
  crevettes: 'crevettes',
  oeuf: 'œuf',
  œuf: 'œuf',
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class AiService {
  suggestMenuItem(dto: SuggestMenuDto): MenuSuggestion {
    const keywordsNormalized = normalize(dto.dishKeywords);
    const categoryFallback = (dto.category?.toLowerCase() ?? 'plat') as
      | 'entree'
      | 'plat'
      | 'dessert'
      | 'boisson';

    const match = this.findDishMatch(keywordsNormalized);

    if (match) {
      // Enrichit la description avec la protéine si précisée dans les mots-clés
      const proteinAddon = this.detectProtein(keywordsNormalized, match);
      const description = proteinAddon
        ? `${match.description} Préparé avec ${proteinAddon}.`
        : match.description;

      return {
        name: match.name,
        description: description.slice(0, 240),
        suggestedPriceXaf: match.priceXaf,
        allergens: match.allergens,
        preparationTimeMin: match.prepTimeMin,
        category: match.category,
        matchedDish: match.keys[0],
      };
    }

    // Fallback générique : on capitalise les mots-clés et on assemble
    // une description neutre en français camerounais.
    return this.genericFallback(dto.dishKeywords, categoryFallback);
  }

  private findDishMatch(normalizedKeywords: string): DishTemplate | null {
    for (const dish of CAMEROONIAN_DISHES) {
      for (const key of dish.keys) {
        const normalizedKey = normalize(key);
        if (normalizedKeywords.includes(normalizedKey)) {
          return dish;
        }
      }
    }
    return null;
  }

  private detectProtein(
    normalizedKeywords: string,
    matched: DishTemplate,
  ): string | null {
    // Si le plat a déjà la protéine dans son nom, on n'ajoute rien
    const matchedNameNorm = normalize(matched.name);
    for (const [hint, phrase] of Object.entries(PROTEIN_HINTS)) {
      if (
        normalizedKeywords.includes(hint) &&
        !matchedNameNorm.includes(hint)
      ) {
        return phrase;
      }
    }
    return null;
  }

  private genericFallback(
    rawKeywords: string,
    category: 'entree' | 'plat' | 'dessert' | 'boisson',
  ): MenuSuggestion {
    const trimmed = rawKeywords.trim();
    const capitalized = trimmed
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const normalizedKeywords = normalize(trimmed);
    const allergens: string[] = [];
    if (normalizedKeywords.includes('arachide')) allergens.push('arachide');
    if (normalizedKeywords.includes('poisson')) allergens.push('poisson');
    if (normalizedKeywords.includes('crevette')) allergens.push('crustaces');
    if (normalizedKeywords.includes('lait') || normalizedKeywords.includes('fromage'))
      allergens.push('lait');

    const priceByCategory = {
      entree: 1000,
      plat: 2000,
      dessert: 1000,
      boisson: 500,
    };

    const templateByCategory = {
      entree: `Entrée maison préparée avec soin à partir de ${trimmed}. Servi frais pour ouvrir l'appétit.`,
      plat: `Plat savoureux à base de ${trimmed}, mijoté selon la recette camerounaise traditionnelle. Accompagnement au choix.`,
      dessert: `Dessert gourmand à base de ${trimmed}, préparé maison avec des produits locaux.`,
      boisson: `Boisson rafraîchissante à base de ${trimmed}, servie bien fraîche.`,
    };

    return {
      name: capitalized.slice(0, 50) || 'Plat maison',
      description: templateByCategory[category].slice(0, 240),
      suggestedPriceXaf: priceByCategory[category],
      allergens,
      preparationTimeMin: category === 'boisson' ? 5 : 25,
      category,
      matchedDish: null,
    };
  }
}
