import { useEffect, useRef, useState } from 'react'

/** Oryginalny Clippy (Office Assistant) — sprite sheet z clippy.js / Microsoft Agent. */

export type SpinaczMood = 'idle' | 'talk' | 'think' | 'send' | 'done' | 'mad'

interface SpinaczAvatarProps {
  mood?: SpinaczMood
  /** Skala względem oryginalnej klatki 124×93. */
  scale?: number
  className?: string
  /** @deprecated użyj scale */
  size?: number
}

type AgentFrame = {
  duration: number
  images?: [number, number][]
  branching?: { branches: Array<{ weight: number; frameIndex: number }> }
}

type AgentAnimation = {
  frames: AgentFrame[]
}

type AgentData = {
  framesize: [number, number]
  animations: Record<string, AgentAnimation>
}

const MAP_URL = '/spinacz/map.png'
const AGENT_URL = '/spinacz/agent.json'
const SHEET_W = 3348
const SHEET_H = 3162

const MOOD_ANIMS: Record<SpinaczMood, string[]> = {
  idle: ['RestPose', 'IdleEyeBrowRaise', 'IdleFingerTap', 'Idle1_1', 'IdleSideToSide', 'IdleHeadScratch'],
  talk: ['Explain', 'Wave', 'GestureRight', 'GetAttention'],
  think: ['Thinking', 'Searching', 'Processing'],
  send: ['SendMail', 'Writing', 'Processing'],
  done: ['Congratulate', 'Wave'],
  mad: ['GetAttention', 'Alert', 'GestureUp'],
}

let agentCache: AgentData | null = null
let agentPromise: Promise<AgentData> | null = null

function loadAgent(): Promise<AgentData> {
  if (agentCache) return Promise.resolve(agentCache)
  if (!agentPromise) {
    agentPromise = fetch(AGENT_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Nie udało się wczytać ${AGENT_URL}`)
        return r.json() as Promise<AgentData>
      })
      .then((data) => {
        agentCache = data
        return data
      })
  }
  return agentPromise
}

function pickAnim(mood: SpinaczMood, agent: AgentData): string {
  const pool = MOOD_ANIMS[mood].filter((name) => agent.animations[name])
  if (pool.length === 0) return 'RestPose'
  if (mood === 'idle' && Math.random() < 0.45 && agent.animations.RestPose) return 'RestPose'
  return pool[Math.floor(Math.random() * pool.length)] ?? 'RestPose'
}

function nextFrameIndex(frame: AgentFrame, index: number, total: number): number | 'end' {
  if (frame.branching?.branches?.length) {
    const roll = Math.random() * 100
    let acc = 0
    for (const b of frame.branching.branches) {
      acc += b.weight
      if (roll <= acc) return b.frameIndex
    }
  }
  const next = index + 1
  return next >= total ? 'end' : next
}

export default function SpinaczAvatar({
  mood = 'idle',
  scale,
  size,
  className = '',
}: SpinaczAvatarProps) {
  const [agent, setAgent] = useState<AgentData | null>(agentCache)
  const [pos, setPos] = useState<[number, number]>([0, 0])
  const animNameRef = useRef('RestPose')
  const frameRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const moodRef = useRef(mood)

  const frameW = agent?.framesize[0] ?? 124
  const frameH = agent?.framesize[1] ?? 93
  const resolvedScale = scale ?? (typeof size === 'number' ? Math.max(0.7, size / frameW) : 1.2)
  const displayW = Math.round(frameW * resolvedScale)
  const displayH = Math.round(frameH * resolvedScale)

  useEffect(() => {
    let alive = true
    loadAgent()
      .then((data) => {
        if (alive) setAgent(data)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  useEffect(() => {
    if (!agent) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const showFrame = (animName: string, index: number) => {
      const img = agent.animations[animName]?.frames[index]?.images?.[0]
      if (img) setPos(img)
    }

    const play = (name: string) => {
      clearTimer()
      animNameRef.current = name
      frameRef.current = 0
      showFrame(name, 0)
      if (reducedMotion) return

      const step = () => {
        const animName = animNameRef.current
        const anim = agent.animations[animName]
        if (!anim?.frames?.length) return
        const index = frameRef.current
        const frame = anim.frames[index]
        if (!frame) return
        showFrame(animName, index)

        timerRef.current = window.setTimeout(() => {
          const next = nextFrameIndex(frame, index, anim.frames.length)
          if (next === 'end') {
            if (moodRef.current === 'idle') {
              play(pickAnim('idle', agent))
            } else if (agent.animations.RestPose) {
              animNameRef.current = 'RestPose'
              frameRef.current = 0
              showFrame('RestPose', 0)
            }
            return
          }
          frameRef.current = next
          step()
        }, Math.max(30, frame.duration || 100))
      }

      step()
    }

    play(pickAnim(mood, agent))

    let idleKick: number | null = null
    if (mood === 'idle' && !reducedMotion) {
      idleKick = window.setInterval(() => {
        if (moodRef.current === 'idle') play(pickAnim('idle', agent))
      }, 7000)
    }

    return () => {
      clearTimer()
      if (idleKick != null) window.clearInterval(idleKick)
    }
  }, [agent, mood])

  return (
    <div
      className={`spinacz-sprite ${className}`.trim()}
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${MAP_URL})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `-${Math.round(pos[0] * resolvedScale)}px -${Math.round(pos[1] * resolvedScale)}px`,
        backgroundSize: `${Math.round(SHEET_W * resolvedScale)}px ${Math.round(SHEET_H * resolvedScale)}px`,
      }}
      aria-hidden
    />
  )
}
