import { NextFunction, Request, Response } from 'express'
import axios from 'axios'
import { z } from 'zod'

const descriptionSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().optional(),
  subcategory: z.string().trim().optional(),
  currentDescription: z.string().optional(),
  retry: z.boolean().optional(),
})

const orderDescriptionSchema = z.object({
  name: z.string().trim().optional(),
  venue: z.string().trim().optional(),
  status: z.string().trim().optional(),
  rawText: z.string().trim().min(1),
  retry: z.boolean().optional(),
})

const offerClientDescriptionSchema = z.object({
  orderName: z.string().trim().min(1),
  venue: z.string().trim().optional(),
  clientCompanyName: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  internalDescription: z.string().max(8000).optional(),
  stagesSummary: z.string().max(4000).optional(),
  equipmentSummary: z.string().max(4000).optional(),
  currentClientDescription: z.string().max(12000).optional(),
  retry: z.boolean().optional(),
})

export const generateDescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = descriptionSchema.parse(req.body)
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'Brak konfiguracji AI (OPENROUTER_API_KEY).' })
    }

    const contextParts = [
      payload.category ? `kategoria: ${payload.category}` : '',
      payload.subcategory ? `podkategoria: ${payload.subcategory}` : '',
    ].filter(Boolean)

    const systemPrompt =
      'Tworzysz zwięzłe opisy po polsku do katalogu sprzętu i zasobów eventowych.'

    const userPrompt = [
      `Nazwa: ${payload.name}`,
      contextParts.length ? `Kontekst: ${contextParts.join(', ')}` : '',
      payload.currentDescription ? `Aktualny opis: ${payload.currentDescription}` : '',
      payload.retry
        ? 'Wygeneruj inną wersję niż poprzednio. Zachowaj sens, zmień sformułowania.'
        : '',
      'Wygeneruj dokładnie 2 krótkie zdania. Bez list, bez emoji, bez cudzysłowów.',
    ]
      .filter(Boolean)
      .join('\n')

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: payload.retry ? 1.0 : 0.7,
        max_tokens: 180,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    )

    const content = response.data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ error: 'AI nie zwróciło opisu.' })
    }

    const description = content.replace(/\s+/g, ' ').trim()
    return res.json({ description })
  } catch (error) {
    next(error)
  }
}

export const rewriteOrderDescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = orderDescriptionSchema.parse(req.body)
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'Brak konfiguracji AI (OPENROUTER_API_KEY).' })
    }

    // Ograniczamy wejście, żeby kontrolować koszty tokenów.
    const rawText = payload.rawText.slice(0, 2500)
    const context = [
      payload.name ? `Nazwa zlecenia: ${payload.name}` : '',
      payload.venue ? `Miejsce: ${payload.venue}` : '',
      payload.status ? `Status: ${payload.status}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const systemPrompt =
      [
        'Jesteś menedżerem projektów po stronie wykonawcy usług eventowych. Tworzysz wewnętrzne opisy zleceń do briefu/koordynacji/planowania.',
        '',
        'Zasady bezwzględne:',
        '- Nie używaj żadnych nazw firm ani marek (ani wykonawcy, ani klienta). Nie pisz m.in. "Lama Stage".',
        '- Nie cytuj dosłownie notatek klienta; przepisz je na język operacyjny wykonawcy.',
        '- Zero lania wody i okrągłych słów: żadnych "kompleksowo", "profesjonalnie", "najwyższa jakość", "zadbamy o".',
        '- Brak list, emoji i nagłówków. Tylko 4–6 zdań.',
        '',
        'Co ma się znaleźć w opisie:',
        '- Co dokładnie realizujemy (zakres + kluczowe deliverables).',
        '- Gdzie i kiedy (termin / zakres dat) oraz najważniejsze ograniczenia logistyczne/techniczne.',
        '- Co jest po stronie klienta do potwierdzenia (jeśli w notatkach są braki/niejasności).',
      ].join('\n')

    const userPrompt = [
      'Kontekst zlecenia (informacje podstawowe):',
      context || '(brak podstawowych informacji)',
      '',
      'Notatki od klienta (może zawierać pytania, zapytania, opisy potrzeb):',
      rawText,
      payload.retry
        ? 'Stwórz alternatywną wersję z innymi sformułowaniami, ale zachowaj tę samą treść.'
        : '',
      'Utwórz wewnętrzny opis tego zlecenia (4–6 zdań) z perspektywy wykonawcy. Gdy w notatkach klienta jest mowa o "poszukiwaniu firmy", "szukamy kogoś" itp., przekształć to na stwierdzenie realizacyjne (co wykonawca zapewnia). Wspomnij kluczowe elementy: co, gdzie, kiedy (termin) oraz główne wymagania techniczne/logistyczne. Pisz konkretnie i operacyjnie.',
    ]
      .filter(Boolean)
      .join('\n')

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: payload.retry ? 0.8 : 0.35,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    )

    const content = response.data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ error: 'AI nie zwróciło opisu.' })
    }

    const description = content.replace(/\s+/g, ' ').trim()
    return res.json({ description })
  } catch (error) {
    next(error)
  }
}

export const generateOfferClientDescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = offerClientDescriptionSchema.parse(req.body)
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'Brak konfiguracji AI (OPENROUTER_API_KEY).' })
    }

    const internal = (payload.internalDescription ?? '').slice(0, 8000).trim()
    const hasContext =
      internal.length > 0 ||
      (payload.stagesSummary && payload.stagesSummary.trim().length > 0) ||
      (payload.equipmentSummary && payload.equipmentSummary.trim().length > 0) ||
      (payload.currentClientDescription && payload.currentClientDescription.trim().length > 0)

    if (!hasContext) {
      return res.status(400).json({
        error:
          'Podaj opis techniczny zlecenia lub uzupełnij harmonogram / sprzęt — brak materiału do wygenerowania opisu dla klienta.',
      })
    }

    const contextLines = [
      `Nazwa zlecenia / wydarzenia: ${payload.orderName}`,
      payload.clientCompanyName ? `Klient (firma) – UWAGA: nie używaj tej nazwy w opisie: ${payload.clientCompanyName}` : '',
      payload.venue ? `Miejsce: ${payload.venue}` : '',
      payload.startDate ? `Data od: ${payload.startDate}` : '',
      payload.endDate ? `Data do: ${payload.endDate}` : '',
    ].filter(Boolean)

    const userPrompt = [
      'Dane kontekstowe oferty:',
      contextLines.join('\n'),
      '',
      payload.stagesSummary ? `Harmonogram (skrót):\n${payload.stagesSummary.slice(0, 4000)}` : '',
      payload.equipmentSummary ? `Pozycje sprzętu / zakres (skrót):\n${payload.equipmentSummary.slice(0, 4000)}` : '',
      internal ? `Opis techniczny wewnętrzny (nie kopiuj go dosłownie — przekształć na język dla klienta):\n${internal}` : '',
      payload.currentClientDescription && payload.retry
        ? `Dotychczasowy opis dla klienta (wygeneruj inną wersję, zachowaj sens):\n${payload.currentClientDescription.slice(0, 8000)}`
        : '',
      payload.retry
        ? 'Wygeneruj nową wersję opisu z innymi sformułowaniami, bez zmiany merytoryki.'
        : '',
      [
        'Napisz prosty, zrozumiały opis dla klienta końcowego (po polsku), jak event manager: krótko wyjaśnij co będzie realizowane, kiedy i gdzie.',
        'Zasady: nie używaj żadnych nazw firm/marek (ani wykonawcy, ani klienta); nie pisz "Lama Stage". Nie używaj marketingowych frazesów ani lania wody.',
        'Bez żargonu wewnętrznego, bez list punktowanych, bez emoji, bez nagłówków Markdown.',
      ].join(' '),
      'Wzorzec stylu: "Realizacja nagłośnienia i oświetlenia podczas gali wręczenia nagród dnia 24.12 z montażem dnia 23.12."',
    ]
      .filter(Boolean)
      .join('\n\n')

    const systemPrompt =
      [
        'Jesteś event managerem po stronie wykonawcy. Tworzysz opis oferty widoczny dla klienta.',
        '',
        'Wymagania:',
        '- 2–4 zdania, bez list i bez emoji.',
        '- Konkret: co jest w zakresie, kiedy i gdzie. Zero lania wody.',
        '- Nie używaj żadnych nazw firm/marek (ani wykonawcy, ani klienta).',
      ].join('\n')

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: payload.retry ? 0.75 : 0.45,
        max_tokens: 900,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      }
    )

    const content = response.data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ error: 'AI nie zwróciło opisu.' })
    }

    const description = content.replace(/\r\n/g, '\n').trim()
    return res.json({ description })
  } catch (error) {
    next(error)
  }
}
