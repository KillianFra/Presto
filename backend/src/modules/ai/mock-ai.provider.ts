import type { AppConfig } from '../../config/env.js'
import type { AiProvider, GenerateImageInput } from './ai.types.js'

function buildGeneratedStorageKey(input: GenerateImageInput): string {
  return `projects/${input.project.id}/generated/${input.transformationId}.png`
}

export function createMockAiProvider(config: Readonly<AppConfig>): AiProvider {
  return {
    async analyzeImage(input) {
      const verticalLabel = input.project.vertical === 'IMMOBILIER' ? 'annonce immobiliere' : 'annonce objet'
      const analysis = `Analyse mockee pour ${verticalLabel}: titre "${input.project.title}", asset ${input.originalAsset.storageKey}.`

      return {
        analysis,
        suggestions: [
          {
            label: 'Luminosite naturelle',
            generatedPrompt: `Ameliorer la luminosite et le contraste de cette ${verticalLabel} sans modifier la structure.`,
          },
          {
            label: 'Rendu professionnel',
            generatedPrompt: `Produire un visuel propre, net et realiste pour cette ${verticalLabel}.`,
          },
          {
            label: 'Correction douce',
            generatedPrompt: `Corriger les couleurs, l'exposition et les details tout en conservant une apparence naturelle.`,
          },
        ],
      }
    },

    async generateImage(input) {
      return {
        storageKey: buildGeneratedStorageKey(input),
        mimeType: config.mockGeneratedImageMimeType,
        byteSize: config.mockGeneratedImageByteSize,
        providerName: 'mock-image-provider',
        providerRequestId: `mock-${input.transformationId}`,
        costCents: 0,
        durationMs: 250,
        llmAnalysis: `Generation mockee depuis le prompt interne: ${input.internalPrompt}`,
      }
    },
  }
}
