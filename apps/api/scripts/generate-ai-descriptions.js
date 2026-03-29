const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function readEnvKeyFromFile(key) {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return undefined
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const k = trimmed.slice(0, idx).trim()
    let v = trimmed.slice(idx + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (k === key) return v
  }
  return undefined
}

function toTwoSentences(text) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''

  const parts = normalized.match(/[^.!?]+[.!?]+/g)
  if (!parts || parts.length === 0) return normalized
  return parts.slice(0, 2).join(' ').trim()
}

async function generateDescription(record, apiKey) {
  const isResource = record.category === 'ZASOBY'
  const context = [
    `Nazwa: ${record.name}`,
    `Typ: ${isResource ? 'Zasób' : 'Sprzęt'}`,
    isResource && record.subcategory ? `Kategoria zasobu: ${record.subcategory}` : '',
    !isResource ? `Kategoria: ${record.category}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'deepseek/deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Tworzysz krótkie opisy katalogowe po polsku dla firmy eventowej. Pisz zwięźle i konkretnie.',
        },
        {
          role: 'user',
          content: `${context}\nNapisz dokładnie 2 krótkie zdania opisu. Bez list, bez emoji, bez cudzysłowów.`,
        },
      ],
      temperature: 0.35,
      max_tokens: 90,
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
    throw new Error('AI did not return description')
  }
  return toTwoSentences(content)
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY || readEnvKeyFromFile('OPENROUTER_API_KEY')
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY in environment or apps/api/.env')
  }

  const records = await prisma.equipment.findMany({
    select: { id: true, name: true, category: true, subcategory: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  console.log(`Znaleziono rekordów do aktualizacji: ${records.length}`)
  let success = 0
  let failed = 0

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i]
    let lastErr = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const description = await generateDescription(record, apiKey)
        await prisma.equipment.update({
          where: { id: record.id },
          data: { description },
        })
        success += 1
        break
      } catch (err) {
        lastErr = err
        if (attempt < 3) {
          await sleep(500 * attempt)
        }
      }
    }

    if (lastErr && success + failed < i + 1) {
      failed += 1
      console.error(
        `Błąd [${i + 1}/${records.length}] ${record.name}: ${
          lastErr?.response?.data?.error?.message || lastErr?.message || 'nieznany'
        }`
      )
    }

    if ((i + 1) % 10 === 0 || i + 1 === records.length) {
      console.log(`Postęp: ${i + 1}/${records.length}, sukces: ${success}, błędy: ${failed}`)
    }

    // Delikatny throttle, żeby uniknąć limitów i zbędnych retry.
    await sleep(120)
  }

  console.log(`Zakończono. Sukces: ${success}, błędy: ${failed}`)
}

main()
  .catch((error) => {
    console.error('Przerwano:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
