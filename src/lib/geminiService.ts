// src/lib/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY is not configured");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export interface ProductData {
  title: string;
  description: string;
  features: string[];
  category?: string;
  priceEstimate?: string;
  brand?: string;
  size?: string;
  color?: string;
  material?: string;
  condition?: string;
  gender?: string;
  season?: string;
  suggestedPeriod?: string;
  marketing?: {
    instagramCaption: string;
    hashtags: string[];
    salesEmail: string;
    seoKeywords: string[];
  };
}

export const analyzeProductImage = async (
  base64Image: string,
  mimeType: string,
  writingStyle?: string
): Promise<ProductData[]> => {
  const model = "gemini-2.5-flash";

  const writingStyleInstruction = writingStyle
    ? `\n    WRITING STYLE: When generating the title and description, use this specific writing style:\n    ${writingStyle}\n    `
    : "";

  const prompt = `
    You are an expert fashion analyst for a second-hand clothing marketplace (Vinted).
    Analyze this product image in detail and extract ALL visible information.

    IMPORTANT: Look carefully at any visible tags, labels, or etiquettes on the item to extract brand and size information.
${writingStyleInstruction}
    Identify ALL distinct fashion or accessory products visible in the image.
    If there is only one product, return a single entry.

    For EACH detected product, extract the following information:

    1. BASIC INFO:
       - title: A catchy, descriptive title in French (e.g., "Robe d'été fleurie Zara")
       - description: Detailed description in French highlighting condition, style, and key features (2-3 sentences)${
         writingStyle
           ? " - IMPORTANT: Use the writing style provided above for the description"
           : ""
       }
       - features: 5 key features or selling points in French

    2. BRAND & SIZE:
       - brand: The brand name if visible on tags/labels/logos (if not visible, return null)
       - size: The size if visible on tags/labels (e.g., "M", "38", "42", "S", "XL", etc. - if not visible, return null)

    3. PHYSICAL ATTRIBUTES:
       - color: The main color in French (e.g., "Bleu", "Rouge", "Noir", "Beige", "Multicolore", etc.)
       - material: The fabric/material if identifiable (e.g., "Coton", "Polyester", "Laine", "Jean", "Cuir", "Soie", etc. - if uncertain, return null)

    4. CONDITION:
       - condition: Assess the visible condition. Return ONE of these exact values:
         * "new_with_tags" - if tags are still attached
         * "new_without_tags" - if looks new but no tags
         * "very_good" - excellent condition, minimal wear
         * "good" - good condition, light wear
         * "satisfactory" - acceptable condition, visible wear

    5. TARGET AUDIENCE & CATEGORIZATION:
       - gender: ANALYZE CAREFULLY all visible details to determine target audience. Return ONE of these exact values:
         * "Femmes" - for ADULT women's clothing/accessories (dresses, skirts, women's tops, women's lingerie, heels, feminine handbags, feminine jewelry)
         * "Hommes" - for ADULT men's clothing/accessories (men's shirts, men's pants with masculine cut, suits, ties, men's formal/derby shoes, masculine accessories)
         * "Enfants" - for CHILDREN's items (baby/child sizes visible on tags, childish style, children's patterns, toys, small sizes 0-14 years)
         * "Mixte" - ONLY if truly unisex adult item with no gender indicators (e.g., basic black t-shirt, neutral accessories)
         * IMPORTANT: Do NOT default to "Femmes" - analyze objectively. Look at: cut (fitted=women, straight=could be men), details (lace/ruffles=women, button side=men), indicated size

    6. SEASONALITY:
       - season: Return ONE of these exact values based on the item type:
         * "spring" - for spring items (light jackets, transitional pieces)
         * "summer" - for summer items (shorts, t-shirts, dresses, sandals)
         * "autumn" - for autumn items (sweaters, boots, transitional coats)
         * "winter" - for winter items (heavy coats, boots, scarves)
         * "all-seasons" - for items that can be worn year-round
       - suggestedPeriod: The best months to sell this item in French (e.g., "Mars - Mai", "Juin - Août", "Toute l'année")

    7. PRICING:
       - priceEstimate: Estimated resale price in euros (format: "XX €" - consider condition and brand)

    8. CATEGORY:
       - category: The type of item in French (e.g., "Robe", "T-shirt", "Jean", "Basket", "Sac", "Manteau", etc.)

    9. MARKETING (optional):
       - instagramCaption: Caption with emojis
       - hashtags: 10 relevant hashtags
       - salesEmail: Short email draft
       - seoKeywords: 5 SEO keywords

    CRITICAL: Pay special attention to any visible labels, tags, or etiquettes to extract brand and size information accurately.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  features: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  category: { type: Type.STRING },
                  priceEstimate: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  size: { type: Type.STRING },
                  color: { type: Type.STRING },
                  material: { type: Type.STRING },
                  condition: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  season: { type: Type.STRING },
                  suggestedPeriod: { type: Type.STRING },
                  marketing: {
                    type: Type.OBJECT,
                    properties: {
                      instagramCaption: { type: Type.STRING },
                      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      salesEmail: { type: Type.STRING },
                      seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                  },
                },
                required: ["title", "description", "features"],
              },
            },
          },
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed.products || [];
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Analysis failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé pour l'analyse. Veuillez réessayer plus tard ou activer la facturation sur Google Cloud."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error(
        "Clé API Gemini invalide ou manquante. Vérifiez VITE_GEMINI_API_KEY dans votre fichier .env"
      );
    }

    throw error;
  }
};

export const editProductImage = async (
  base64Image: string,
  mimeType: string,
  instruction: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  // ✅ Global, low-token "human iPhone photo" constraint (single source of truth)
  const HUMAN_IPHONE_CONSTRAINTS =
    "Output must look like an ordinary iPhone photo taken at home: natural ambient light, simple imperfect framing, faithful colors, slight sensor grain, no studio look, no editorial styling, no perfect seamless background, no HDR/glow, no AI artifacts, no over-sharpening. Keep it boring and believable.";

  const enhancedInstruction = `${instruction}
${HUMAN_IPHONE_CONSTRAINTS}
Preserve product details perfectly (logos/text/labels), keep product as focal point, no distortions.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          { text: enhancedInstruction },
        ],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Editing failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. L'édition d'images nécessite un compte avec facturation activée sur Google Cloud. Consultez GEMINI_SETUP.md pour plus d'informations."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error(
        "Clé API Gemini invalide ou manquante. Vérifiez VITE_GEMINI_API_KEY dans votre fichier .env"
      );
    }

    throw error;
  }
};

async function convertImageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert image URL to base64:", error);
    throw error;
  }
}

export interface Suggestion {
  field:
    | "title"
    | "description"
    | "price"
    | "brand"
    | "size"
    | "color"
    | "material"
    | "condition";
  currentValue: string | number;
  suggestedValue: string | number;
  reason: string;
}

export const parseSuggestionValue = (
  field: string,
  value: string | number
): string | number => {
  if (field === "price") {
    const stringValue = String(value);
    const numericValue = parseFloat(
      stringValue.replace(/[^0-9.,]/g, "").replace(",", ".")
    );
    return isNaN(numericValue) ? "" : numericValue.toString();
  }
  return value;
};

export interface CoachAdvice {
  generalAdvice: string;
  suggestions: Suggestion[];
}

export const getListingCoachAdvice = async (
  article: any,
  activePhoto?: string
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const photoPrompt = activePhoto ? "\n\nPhoto attached for visual analysis." : "";

  const prompt = `You are an expert Vinted sales coach. Analyze this listing and provide actionable advice to improve it and sell faster.

**LISTING DATA:**
- Title: ${article.title || "Not set"}
- Description: ${article.description || "Not set"}
- Brand: ${article.brand || "Not set"}
- Price: ${article.price ? article.price + "€" : "Not set"}
- Size: ${article.size || "Not set"}
- Condition: ${article.condition || "Not set"}
- Color: ${article.color || "Not set"}
- Material: ${article.material || "Not set"}
- Photos: ${article.photos?.length || 0} photos${photoPrompt}

**YOUR TASK:**
Provide personalized, actionable advice to improve this listing. Focus on:

1. **Title Quality** - Is it descriptive and keyword-rich?
2. **Description** - Is it detailed, honest, and engaging?
3. **Pricing Strategy** - Is the price competitive?
4. **Photo Quality** - Are there enough high-quality photos?
5. **Missing Information** - What key details are missing?
6. **Quick Wins** - What 2-3 changes would have the biggest impact?

Format your response in French with clear sections using **bold headers** for readability. Be specific and encouraging.`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (activePhoto) {
      let base64Data: string;

      if (activePhoto.startsWith("http://") || activePhoto.startsWith("https://")) {
        base64Data = await convertImageUrlToBase64(activePhoto);
      } else if (activePhoto.startsWith("data:")) {
        base64Data = activePhoto.split(",")[1];
      } else {
        base64Data = activePhoto;
      }

      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      });
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: { parts },
    });

    return response.text || "Désolé, je n'ai pas pu analyser votre annonce pour le moment.";
  } catch (error: any) {
    console.error("Listing coach analysis failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error("Quota Gemini dépassé. Veuillez réessayer plus tard.");
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    throw new Error("Impossible d'analyser l'annonce pour le moment.");
  }
};

export const getStructuredCoachAdvice = async (
  article: any,
  activePhoto?: string
): Promise<CoachAdvice> => {
  const model = "gemini-2.5-flash";

  const photoPrompt = activePhoto ? "\n\nPhoto attached for visual analysis." : "";

  const prompt = `Tu es KELLY, une coach de vente EXPERTE sur Vinted avec 8 ans d'experience et plus de 50 000 ventes reussies.
Tu connais PARFAITEMENT l'algorithme Vinted et les meilleures pratiques SEO marketplace.

**DONNÉES DE L'ANNONCE:**
- Titre: ${article.title || "Non défini"}
- Description: ${article.description || "Non définie"}
- Marque: ${article.brand || "Non définie"}
- Prix: ${article.price ? article.price + "€" : "Non défini"}
- Taille: ${article.size || "Non définie"}
- État: ${article.condition || "Non défini"}
- Couleur: ${article.color || "Non défini"}
- Matière: ${article.material || "Non défini"}
- Photos: ${article.photos?.length || 0} photo(s)${photoPrompt}

**TES CONNAISSANCES VINTED (utilise-les dans tes conseils):**

1. ALGORITHME VINTED:
   - Les articles avec 5+ photos ont 3x plus de vues
   - La première photo doit être parfaite (c'est la miniature)
   - Les titres avec marque + type + détail accrocheur performent mieux
   - Les descriptions de 80-150 mots sont optimales
   - Remplir TOUS les champs booste le référencement

2. BONNES PRATIQUES TITRE (max 60 caractères):
   - Format gagnant: "[Marque] [Type] [Détail accrocheur]"
   - Inclure: marque, type, couleur ou détail distinctif
   - Éviter: mots vagues, majuscules excessives, prix dans le titre

3. BONNES PRATIQUES DESCRIPTION:
   - Commencer par une accroche émotionnelle
   - Mentionner: état, taille, matière, occasion d'achat
   - Ajouter des mots-clés naturellement (style, saison, occasion)
   - Terminer par un call-to-action subtil

4. STRATÉGIE PRIX:
   - Prix trop bas = méfiance, prix trop haut = pas de vues
   - Prévoir marge pour négociation (-10 à -20%)
   - Regarder les prix de vente récents (pas les annonces en cours)

5. PHOTOS QUI VENDENT:
   - Photo 1: article entier sur fond neutre
   - Photo 2-3: détails (étiquettes, textures, finitions)
   - Photo 4-5: article porté ou mise en situation
   - Lumière naturelle, pas de flash

**TA MISSION:**
1. Donner un conseil général encourageant et personnalisé (en français, 60-100 mots)
2. Proposer des suggestions CONCRÈTES pour améliorer l'annonce

Pour chaque suggestion:
- field: le champ à améliorer (title, description, price, brand, size, color, material, condition)
- currentValue: la valeur actuelle
- suggestedValue: ta suggestion améliorée (PRÊTE À COPIER-COLLER)
- reason: pourquoi ce changement aidera à vendre (max 40 mots en français)

IMPORTANT:
- Sois SÉLECTIVE: ne suggère que les changements à FORT IMPACT
- Les suggestions doivent être immédiatement applicables
- Utilise un ton chaleureux et motivant
- Réponds TOUJOURS en français`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (activePhoto) {
      let base64Data: string;

      if (activePhoto.startsWith("http://") || activePhoto.startsWith("https://")) {
        base64Data = await convertImageUrlToBase64(activePhoto);
      } else if (activePhoto.startsWith("data:")) {
        base64Data = activePhoto.split(",")[1];
      } else {
        base64Data = activePhoto;
      }

      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      });
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            generalAdvice: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  field: { type: Type.STRING },
                  currentValue: { type: Type.STRING },
                  suggestedValue: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ["field", "currentValue", "suggestedValue", "reason"],
              },
            },
          },
          required: ["generalAdvice", "suggestions"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed;
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Structured coach analysis failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error("Quota Gemini dépassé. Veuillez réessayer plus tard.");
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    throw new Error("Impossible d'analyser l'annonce pour le moment.");
  }
};

export interface DefectAnalysis {
  overallConditionScore: number;
  defects: {
    type: string;
    severity: 'minor' | 'moderate' | 'severe';
    location: string;
    description: string;
    impactOnPrice: number;
  }[];
  recommendations: string[];
  suggestedDisclosure: string;
  estimatedCondition: string;
}

export const analyzeDefects = async (
  base64Image: string,
  mimeType: string
): Promise<DefectAnalysis> => {
  const model = "gemini-2.5-flash";

  const prompt = `Tu es un expert en inspection de vetements d'occasion pour la revente sur Vinted.
Analyse cette photo de vetement et detecte TOUS les defauts visibles avec precision.

TYPES DE DEFAUTS A DETECTER:
- Taches (huile, vin, encre, transpiration, moisissure...)
- Trous (accrocs, dechirures, usure...)
- Bouloches (pilling sur laine, coton, polyester...)
- Decoloration (delavage, jaunissement, blanchiment...)
- Usure (col use, manches usees, ourlet defait...)
- Coutures (fils tires, coutures defaites, boutons manquants...)
- Odeurs potentielles (traces de transpiration, moisissure visible...)
- Elastiques (etires, detendus...)

Pour chaque defaut detecte, indique:
- type: le type de defaut
- severity: "minor" (petit defaut acceptable), "moderate" (defaut visible), "severe" (defaut majeur)
- location: ou se trouve le defaut (ex: "col", "aisselle gauche", "bas du dos")
- description: description precise du defaut en francais
- impactOnPrice: estimation de l'impact sur le prix en pourcentage negatif (ex: -5, -15, -30)

Fournis aussi:
- overallConditionScore: note globale de 1 a 10 (10 = parfait)
- recommendations: liste de conseils pour la vente (max 3)
- suggestedDisclosure: texte a inclure dans l'annonce pour mentionner les defauts de facon honnete mais vendeuse
- estimatedCondition: "new_with_tags", "new_without_tags", "very_good", "good", ou "satisfactory"

Si aucun defaut n'est visible, retourne un tableau vide pour defects et un score de 10.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallConditionScore: { type: Type.NUMBER },
            defects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  location: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impactOnPrice: { type: Type.NUMBER },
                },
                required: ["type", "severity", "location", "description", "impactOnPrice"],
              },
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedDisclosure: { type: Type.STRING },
            estimatedCondition: { type: Type.STRING },
          },
          required: ["overallConditionScore", "defects", "recommendations", "suggestedDisclosure", "estimatedCondition"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Defect analysis failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini depasse. Veuillez reessayer plus tard.");
    }

    throw new Error("Impossible d'analyser les defauts pour le moment.");
  }
};

export const generateVirtualTryOn = async (
  base64Image: string,
  mimeType: string,
  gender: 'female' | 'male' | 'neutral' = 'female'
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const genderPrompts = {
    female: "a slim female fashion model with natural pose",
    male: "a fit male fashion model with confident pose",
    neutral: "a slim androgynous model with elegant pose"
  };

  const prompt = `Transform this product photo into a lifestyle fashion photo showing the clothing item worn by ${genderPrompts[gender]}.

REQUIREMENTS:
- Keep the EXACT same clothing item with all details preserved (brand logos, patterns, textures, colors)
- Model should be standing naturally, similar to a Zara or H&M catalog photo
- Professional studio lighting with soft shadows
- Clean white or light gray gradient background
- Model face can be partially visible or cropped at chin level
- Show the item's fit and drape realistically
- Natural body proportions, not exaggerated
- The clothing should look exactly as it would in real life when worn
- Keep it photorealistic, not illustrated

OUTPUT: High quality fashion catalog style photo`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Virtual try-on failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini depasse. L'essayage virtuel necessite un compte avec facturation activee.");
    }

    throw new Error("Impossible de generer l'essayage virtuel pour le moment.");
  }
};

export interface ProactiveInsight {
  type: 'price_drop' | 'seasonal' | 'stale' | 'incomplete' | 'opportunity' | 'bundle' | 'seo_optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionLabel: string;
  articleIds?: string[];
  articleTitles?: string[];
  suggestedAction?: {
    type: string;
    value: any;
  };
}

export const optimizeArticleSEO = async (article: any): Promise<{
  seo_keywords: string[];
  hashtags: string[];
  search_terms: string[];
}> => {
  const model = "gemini-2.5-flash";

  const prompt = `Tu es un expert SEO pour Vinted. Optimise le référencement de cet article pour maximiser sa visibilité.

ARTICLE:
- Titre: ${article.title || "Non défini"}
- Description: ${article.description || "Non définie"}
- Marque: ${article.brand || "Non définie"}
- Taille: ${article.size || "Non définie"}
- Couleur: ${article.color || "Non définie"}
- Matière: ${article.material || "Non définie"}
- État: ${article.condition || "Non défini"}
- Saison: ${article.season || "Non définie"}

GÉNÈRE:
1. seo_keywords: 8-12 mots-clés pertinents pour le référencement (termes de recherche populaires)
2. hashtags: 8-12 hashtags sans le symbole # (tendances, style, occasion)
3. search_terms: 10-15 termes de recherche que les acheteurs utiliseraient (incluant variantes orthographiques, synonymes, termes connexes)

RÈGLES:
- Utilise des termes recherchés par les acheteurs français
- Inclus variantes (ex: "jean", "denim", "pantalon jean")
- Pense aux occasions (soirée, casual, travail)
- Inclus le style (vintage, moderne, classique)
- Ajoute des termes de marque similaires si pertinent`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            seo_keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            search_terms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["seo_keywords", "hashtags", "search_terms"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return {
        seo_keywords: parsed.seo_keywords || [],
        hashtags: parsed.hashtags || [],
        search_terms: parsed.search_terms || [],
      };
    }
    return {
      seo_keywords: [],
      hashtags: [],
      search_terms: [],
    };
  } catch (error: any) {
    console.error("SEO optimization failed:", error);
    return {
      seo_keywords: [],
      hashtags: [],
      search_terms: [],
    };
  }
};

export const generateProactiveInsights = async (
  articles: any[],
  soldArticles: any[],
  currentMonth: number
): Promise<ProactiveInsight[]> => {
  const model = "gemini-2.5-flash";

  const seasonMap: Record<number, string> = {
    1: 'winter', 2: 'winter', 3: 'spring',
    4: 'spring', 5: 'spring', 6: 'summer',
    7: 'summer', 8: 'summer', 9: 'autumn',
    10: 'autumn', 11: 'autumn', 12: 'winter'
  };
  const currentSeason = seasonMap[currentMonth];

  const nextMonthSeason = seasonMap[(currentMonth % 12) + 1];

  const articlesSummary = articles.map(a => ({
    id: a.id,
    title: a.title,
    brand: a.brand,
    price: a.price,
    status: a.status,
    season: a.season,
    daysListed: a.published_at
      ? Math.floor((Date.now() - new Date(a.published_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    hasPhotos: a.photos?.length > 0,
    photoCount: a.photos?.length || 0,
    hasDescription: !!a.description && a.description.length > 50,
    hasSEO: !!(a.seo_keywords?.length > 0 || a.hashtags?.length > 0 || a.search_terms?.length > 0),
    seoKeywordsCount: a.seo_keywords?.length || 0,
    hashtagsCount: a.hashtags?.length || 0,
    searchTermsCount: a.search_terms?.length || 0,
  }));

  const soldSummary = {
    totalSold: soldArticles.length,
    averagePrice: soldArticles.length > 0
      ? soldArticles.reduce((sum, a) => sum + (a.sold_price || a.price), 0) / soldArticles.length
      : 0,
    recentSales: soldArticles.filter(a => {
      const soldDate = new Date(a.sold_at || a.updated_at);
      return (Date.now() - soldDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length,
  };

  const prompt = `Tu es Kelly, une coach de vente experte sur Vinted. Analyse ce dressing et genere des insights PROACTIFS et ACTIONABLES.

CONTEXTE:
- Mois actuel: ${currentMonth} (saison: ${currentSeason})
- Prochaine saison: ${nextMonthSeason}
- Articles en vente: ${articlesSummary.length}
- Statistiques ventes: ${JSON.stringify(soldSummary)}

ARTICLES DU DRESSING:
${JSON.stringify(articlesSummary, null, 2)}

GENERE DES INSIGHTS selon ces categories:
1. ready_to_publish - Articles en draft qui sont COMPLETS et prets a etre publies (actionLabel: "Publier mes brouillons")
2. ready_to_list - Articles qui peuvent etre mis en vente maintenant (actionLabel: "Mettre en vente")
3. price_drop - Articles stagnants qui beneficieraient d'une baisse de prix
4. seasonal - Articles de saison a mettre en avant ou anticiper
5. stale - Articles publies depuis longtemps sans vente (>30 jours)
6. incomplete - Articles avec informations manquantes (photos, description)
7. seo_optimization - Articles qui manquent de mots-cles SEO, hashtags ou termes de recherche (actionLabel: "Optimiser le SEO")
8. opportunity - Opportunites detectees (marque populaire, tendance)
9. bundle - Suggestions de lots intelligents (meme marque, style coordonne)

REGLES:
- Maximum 5 insights au total
- Priorise les actions a fort impact
- Sois specifique avec les IDs d'articles concernes
- Le message doit etre motivant et actionnable
- Suggere des actions concretes (baisser de X%, ajouter photos, creer lot, publier, mettre en vente, optimiser SEO)`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  title: { type: Type.STRING },
                  message: { type: Type.STRING },
                  actionLabel: { type: Type.STRING },
                  articleIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  suggestedAction: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      value: { type: Type.STRING },
                    },
                  },
                },
                required: ["type", "priority", "title", "message", "actionLabel"],
              },
            },
          },
          required: ["insights"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed.insights || [];
    }
    return [];
  } catch (error: any) {
    console.error("Proactive insights generation failed:", error);
    return [];
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  const model = "gemini-2.5-flash-preview-tts";

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore",
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const base64Data = part.inlineData.data;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        }
      }
    }

    throw new Error("No audio data found in response");
  } catch (error: any) {
    console.error("Speech generation failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé pour la synthèse vocale. Veuillez réessayer plus tard."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    throw error;
  }
};
