// Service Google Gemini pour BroolyKid AI
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Créer client Gemini
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface AIResponse {
  text: string;
  model: string;
  provider: string;
}

/**
 * Génère une réponse spirituelle avec Google Gemini
 */
export async function generateSpiritualResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: any[] = []
): Promise<AIResponse> {

  // Vérifier que la clé API est configurée
  if (!genAI) {
    console.warn('GEMINI_API_KEY not configured, using fallback');
    return getFallbackResponse();
  }

  try {
    // Créer le modèle avec le system prompt
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Modèle le plus récent et performant
      systemInstruction: systemPrompt,
    });

    // Configuration de génération
    const generationConfig = {
      temperature: 0.8, // Créativité pour réponses spirituelles
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    };

    // Construire l'historique pour Gemini
    const chat = model.startChat({
      generationConfig,
      history: buildGeminiHistory(conversationHistory),
    });

    // Envoyer le message
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;

    return {
      text: response.text(),
      model: 'gemini-2.0-flash-exp',
      provider: 'google-gemini'
    };

  } catch (error: any) {
    console.error('Google Gemini error:', error.message);

    // Si erreur, retourner fallback
    return getFallbackResponse();
  }
}

/**
 * Construire l'historique au format Gemini
 */
function buildGeminiHistory(history: any[]): any[] {
  // Limiter à 10 derniers messages pour éviter token overflow
  const recentHistory = history.slice(-10);

  return recentHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

/**
 * Réponse de secours si Gemini indisponible
 */
function getFallbackResponse(): AIResponse {
  return {
    text: `🙏 Je rencontre une difficulté technique momentanée.

Les serveurs d'IA sont temporairement indisponibles.
Puis-je reformuler votre question dans quelques instants ?

En attendant, voici une sagesse pour toi :
"Tout est Esprit, l'Univers est Mental" - Le Kybalion

Comme en haut, comme en bas.
Ce que tu cherches te cherche aussi.

Avec patience et lumière 💫`,
    model: 'fallback',
    provider: 'fallback'
  };
}
