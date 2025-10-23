// Service IA avec Hugging Face pour BroolyKid
import { HfInference } from '@huggingface/inference';

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Créer client Hugging Face
const hf = HF_API_KEY ? new HfInference(HF_API_KEY) : null;

// Modèles recommandés pour BroolyKid (spiritualité + philosophie)
const MODELS = {
  primary: 'mistralai/Mistral-7B-Instruct-v0.2', // Excellent français + spiritualité
  backup: 'meta-llama/Meta-Llama-3-8B-Instruct', // Backup si Mistral saturé
  fast: 'microsoft/Phi-3-mini-4k-instruct' // Rapide pour questions simples
};

export interface AIResponse {
  text: string;
  model: string;
  provider: string;
}

/**
 * Génère une réponse spirituelle avec Hugging Face
 */
export async function generateSpiritualResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: any[] = []
): Promise<AIResponse> {

  // Vérifier que la clé API est configurée
  if (!hf) {
    console.warn('HUGGINGFACE_API_KEY not configured, using fallback');
    return getFallbackResponse();
  }

  try {
    // Construire le prompt complet avec historique
    const fullPrompt = buildPrompt(systemPrompt, userMessage, conversationHistory);

    // Appeler Hugging Face avec le modèle principal (Mistral 7B)
    const response = await hf.textGeneration({
      model: MODELS.primary,
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1,
        return_full_text: false
      }
    });

    return {
      text: cleanResponse(response.generated_text),
      model: MODELS.primary,
      provider: 'huggingface'
    };

  } catch (error: any) {
    console.error('Hugging Face primary model failed:', error.message);

    // Fallback vers Llama 3
    try {
      const fullPrompt = buildPrompt(systemPrompt, userMessage, conversationHistory);

      const response = await hf!.textGeneration({
        model: MODELS.backup,
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 800,
          temperature: 0.7,
          top_p: 0.9,
          return_full_text: false
        }
      });

      return {
        text: cleanResponse(response.generated_text),
        model: MODELS.backup,
        provider: 'huggingface'
      };

    } catch (backupError) {
      console.error('Hugging Face backup model failed:', backupError);

      // Dernier fallback : réponse par défaut
      return getFallbackResponse();
    }
  }
}

/**
 * Construire le prompt avec system prompt + historique + question
 */
function buildPrompt(
  systemPrompt: string,
  userMessage: string,
  history: any[]
): string {
  let prompt = `${systemPrompt}\n\n`;

  // Ajouter historique (limité à 5 derniers messages pour éviter token overflow)
  const recentHistory = history.slice(-5);
  recentHistory.forEach(msg => {
    const role = msg.role === 'user' ? 'Utilisateur' : 'BroolyKid AI';
    prompt += `${role}: ${msg.content}\n\n`;
  });

  // Ajouter message actuel
  prompt += `Utilisateur: ${userMessage}\n\nBroolyKid AI:`;

  return prompt;
}

/**
 * Nettoyer la réponse générée
 */
function cleanResponse(text: string): string {
  // Retirer répétitions du prompt
  let cleaned = text.trim();

  // Retirer marqueurs de rôle si présents
  cleaned = cleaned.replace(/^(BroolyKid AI|Assistant|AI):\s*/i, '');

  // Retirer le prompt original s'il est répété
  cleaned = cleaned.replace(/^Utilisateur:.*?\n\n/s, '');

  // Limiter à une réponse cohérente (jusqu'au premier double saut de ligne suivi d'un nouveau rôle)
  const stopPatterns = ['\n\nUtilisateur:', '\n\nUser:', '\n\nHuman:'];
  for (const pattern of stopPatterns) {
    const index = cleaned.indexOf(pattern);
    if (index !== -1) {
      cleaned = cleaned.substring(0, index);
    }
  }

  return cleaned.trim();
}

/**
 * Réponse de secours si IA indisponible
 */
function getFallbackResponse(): AIResponse {
  return {
    text: `🙏 Je rencontre une difficulté technique momentanée.

Les serveurs d'IA sont temporairement indisponibles.
Puis-je reformuler votre question dans quelques instants ?

En attendant, voici une sagesse pour toi :
"Tout est Esprit, l'Univers est Mental" - Le Kybalion

Avec patience et lumière 💫`,
    model: 'fallback',
    provider: 'fallback'
  };
}

// Export des modèles pour info
export { MODELS };
