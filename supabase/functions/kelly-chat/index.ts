import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai@1.31.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return new Response(
        JSON.stringify({
          error: "La cle API Gemini n'est pas configuree."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header manquant" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifie" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { question, articleContext } = await req.json();

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return new Response(
        JSON.stringify({ error: "Question requise" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contextInfo = articleContext ? `
**CONTEXTE DE L'ARTICLE:**
${articleContext.title ? `- Titre: ${articleContext.title}` : ''}
${articleContext.description ? `- Description: ${articleContext.description}` : ''}
${articleContext.brand ? `- Marque: ${articleContext.brand}` : ''}
${articleContext.size ? `- Taille: ${articleContext.size}` : ''}
${articleContext.price ? `- Prix: ${articleContext.price}€` : ''}
${articleContext.condition ? `- Etat: ${articleContext.condition}` : ''}
${articleContext.color ? `- Couleur: ${articleContext.color}` : ''}
${articleContext.material ? `- Matiere: ${articleContext.material}` : ''}
${articleContext.category ? `- Categorie: ${articleContext.category}` : ''}
${articleContext.season ? `- Saison: ${articleContext.season}` : ''}
${articleContext.photos ? `- Nombre de photos: ${articleContext.photos.length}` : ''}
` : '';

    const prompt = `Tu es KELLY, une coach de vente EXPERTE sur Vinted avec 8 ans d'experience et plus de 50 000 ventes reussies.
Tu es amicale, professionnelle et tu donnes des conseils concrets et actionables.

L'utilisateur a une question sur son article Vinted.
${contextInfo}

**QUESTION DE L'UTILISATEUR:**
${question}

**TES CONNAISSANCES VINTED:**
- Algorithme Vinted: les articles avec 5+ photos ont 3x plus de vues
- Les titres avec marque + type + detail accrocheur performent mieux
- Les descriptions de 80-150 mots sont optimales
- Remplir TOUS les champs booste le referencement
- Prix: prevoir marge pour negociation (-10 a -20%)
- Photos: lumiere naturelle, fond neutre, details visibles
- Timing: vendre en debut de saison pour articles saisonniers
- SEO: utiliser mots-cles recherches (ex: "robe ete femme M")

**INSTRUCTIONS:**
1. Reponds de maniere amicale et professionnelle
2. Donne des conseils CONCRETS et ACTIONABLES bases sur le contexte
3. Si tu n'as pas assez d'informations, demande des precisions
4. Utilise des emojis avec parcimonie pour rendre la conversation agreable
5. Cite des exemples concrets quand c'est pertinent
6. Sois encourageante et positive
7. Garde tes reponses courtes et precises (max 200 mots)

Reponds UNIQUEMENT a la question posee. Ne propose pas d'analyse complete si on ne te le demande pas.`;

    console.log("Sending chat request to Gemini");

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [{ text: prompt }]
        }
      });

      console.log("Gemini chat response received");

      if (!response.text) {
        console.error("Empty response from Gemini");
        return new Response(
          JSON.stringify({ error: "Kelly n'a pas pu repondre. Veuillez reessayer." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ answer: response.text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (geminiError: any) {
      console.error("Gemini API error:", geminiError);

      let errorMessage = "Erreur lors de la discussion avec Kelly";

      if (geminiError?.message?.includes('quota') || geminiError?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "Quota Gemini depasse. Veuillez reessayer plus tard.";
      } else if (geminiError?.message?.includes('API key')) {
        errorMessage = "Cle API Gemini invalide.";
      } else if (geminiError?.message) {
        errorMessage += `: ${geminiError.message}`;
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in kelly-chat:", error);
    return new Response(
      JSON.stringify({ error: `Erreur serveur: ${error?.message || "Unknown error"}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
