import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI, Type } from "npm:@google/genai@1.31.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const FUNCTION_VERSION = "3.0.0-NO-MAIN-CATEGORY";

interface AnalysisResult {
  title: string;
  description: string;
  brand: string;
  sub_category?: string;
  category: string;
  subcategory?: string;
  color: string;
  material?: string;
  size?: string;
  condition: string;
  season: string;
  suggestedPeriod?: string;
  estimatedPrice?: number;
  seoKeywords?: string[];
  hashtags?: string[];
  searchTerms?: string[];
  confidenceScore?: number;
}

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
          error: "La cle API Gemini n'est pas configuree"
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

    const { imageUrls, sellerId, isLot, lotArticles, usefulInfo } = await req.json();

    console.log(`🚀 EDGE FUNCTION VERSION: ${FUNCTION_VERSION}`);
    console.log("📥 Request received:", {
      imageCount: imageUrls?.length,
      usefulInfo,
      isLot,
      sellerId
    });

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Au moins une URL d'image est requise" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let writingStyle = "Description detaillee et attractive";

    if (sellerId) {
      const { data: familyMember } = await supabase
        .from("family_members")
        .select("persona_id, writing_style")
        .eq("id", sellerId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (familyMember) {
        if (familyMember.writing_style) {
          writingStyle = familyMember.writing_style;
        } else if (familyMember.persona_id) {
          const personaStyles: Record<string, string> = {
            minimalist: "Descriptions courtes, claires et efficaces",
            enthusiast: "Dynamique, positive et pleine d'energie",
            professional: "Experte, technique et detaillee",
            friendly: "Chaleureuse, accessible et decontractee",
            elegant: "Raffinee, sophistiquee et chic",
            eco_conscious: "Responsable avec focus sur la durabilite",
            trendy: "Tendance et a la pointe de la mode",
            storyteller: "Raconte une histoire autour de l'article",
            custom: writingStyle
          };
          writingStyle = personaStyles[familyMember.persona_id] || writingStyle;
        }
      }
    }

    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    for (const url of imageUrls) {
      try {
        const parsedUrl = new URL(url);
        const pathMatch = parsedUrl.pathname.match(/\/storage\/v1\/object\/public\/article-photos\/(.+)$/);

        if (!pathMatch) {
          console.error("Invalid storage URL format:", url);
          continue;
        }

        const filePath = pathMatch[1];
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("article-photos")
          .download(filePath);

        if (downloadError || !fileData) {
          console.error("Failed to download:", filePath, downloadError?.message);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let base64 = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64 = btoa(base64);

        const contentType = fileData.type || "image/jpeg";

        imageParts.push({
          inlineData: {
            mimeType: contentType,
            data: base64
          }
        });
      } catch (imgError) {
        console.error("Error processing image:", imgError);
      }
    }

    if (imageParts.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Impossible de charger les images"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Successfully processed ${imageParts.length} images`);

    const prompt = `Tu es KELLY, experte Vinted avec 8 ans d'experience.

${usefulInfo ? `🚨 INFORMATIONS IMPORTANTES DU VENDEUR 🚨
"${usefulInfo}"

Ces informations du vendeur sont a prendre en compte pour l'analyse !

` : ''}Analyse ces ${imageUrls.length} photo(s) et retourne un JSON avec:

- title: Titre accrocheur max 60 caracteres
- description: Description attractive 80-120 mots (style: ${writingStyle})
- brand: Marque ou "Sans marque"
- sub_category: Sous-categorie (ex: "Vetements", "Chaussures", "Sacs")
- category: Type general (ex: "Veste", "Pantalon", "Robe")
- subcategory: Type precis (ex: "Veste en jean bleue")
- color: Couleur principale
- material: Matiere principale
- size: Taille si visible
- condition: "new_with_tags", "new_without_tags", "very_good", "good", "satisfactory"
- season: "spring", "summer", "autumn", "winter", "all-seasons"
- suggestedPeriod: Meilleure periode de vente
- estimatedPrice: Prix en euros
- seoKeywords: 8 mots-cles
- hashtags: 10 hashtags
- searchTerms: 5 termes de recherche
- confidenceScore: Score 0-100`;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const parts: any[] = [
        { text: prompt },
        ...imageParts
      ];

      console.log("🤖 Calling Gemini API...");

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              brand: { type: Type.STRING },
              sub_category: { type: Type.STRING },
              category: { type: Type.STRING },
              subcategory: { type: Type.STRING },
              color: { type: Type.STRING },
              material: { type: Type.STRING },
              size: { type: Type.STRING },
              condition: { type: Type.STRING },
              season: { type: Type.STRING },
              suggestedPeriod: { type: Type.STRING },
              estimatedPrice: { type: Type.NUMBER },
              seoKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              searchTerms: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              confidenceScore: { type: Type.NUMBER }
            },
            required: ["title", "description", "brand", "category", "color", "condition", "season"]
          }
        }
      });

      if (!response.text) {
        console.error("❌ Empty Gemini response");
        return new Response(
          JSON.stringify({ error: "L'IA n'a pas pu analyser les images" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("✅ Gemini response received");
      const parsedResponse = JSON.parse(response.text);

      console.log("📊 RAW Gemini Response:", JSON.stringify(parsedResponse, null, 2));

      const result: AnalysisResult = {
        title: parsedResponse.title || "Article à vendre",
        description: parsedResponse.description || "Article en bon état",
        brand: parsedResponse.brand || "Sans marque",
        sub_category: parsedResponse.sub_category,
        category: parsedResponse.category || "Vêtement",
        subcategory: parsedResponse.subcategory,
        color: parsedResponse.color || "Multicolore",
        material: parsedResponse.material,
        size: parsedResponse.size,
        condition: parsedResponse.condition || "good",
        season: parsedResponse.season || "all-seasons",
        suggestedPeriod: parsedResponse.suggestedPeriod,
        estimatedPrice: parsedResponse.estimatedPrice,
        seoKeywords: parsedResponse.seoKeywords || [],
        hashtags: parsedResponse.hashtags || [],
        searchTerms: parsedResponse.searchTerms || [],
        confidenceScore: parsedResponse.confidenceScore || 80,
      };

      console.log("📤 FINAL RESULT - Full object:", JSON.stringify(result, null, 2));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (geminiError: any) {
      console.error("❌ Gemini API error:", geminiError);

      let errorMessage = "Erreur lors de l'analyse avec Gemini";

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
    console.error("❌ Error in analyze-article-image:", error);
    return new Response(
      JSON.stringify({ error: `Erreur serveur: ${error?.message || "Unknown error"}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
