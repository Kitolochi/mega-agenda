import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  pulseSpeed: number
  pulsePhase: number
}

interface Orb {
  x: number
  y: number
  radius: number
  color: [number, number, number]
  vx: number
  vy: number
  pulsePhase: number
  pulseSpeed: number
}

interface WaveLayer {
  offset: number
  speed: number
  amplitude: number
  frequency: number
  color: [number, number, number]
  alpha: number
}

const COLORS = [
  [108, 142, 239],  // accent-blue
  [167, 139, 250],  // accent-purple
  [52, 211, 153],   // accent-emerald
  [244, 114, 182],  // accent-rose
  [251, 146, 60],   // accent-orange
] as const

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let w = 0
    let h = 0
    let particles: Particle[] = []
    let orbs: Orb[] = []
    let waves: WaveLayer[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.offsetWidth
      h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      init()
    }

    const init = () => {
      // Floating particles — more of them, bigger
      const count = Math.floor((w * h) / 12000)
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2.5 + 0.5,
        color: `${COLORS[Math.floor(Math.random() * COLORS.length)].join(',')}`,
        alpha: Math.random() * 0.5 + 0.15,
        pulseSpeed: Math.random() * 0.025 + 0.008,
        pulsePhase: Math.random() * Math.PI * 2,
      }))

      // Large aurora orbs — bigger, more visible, more of them
      orbs = Array.from({ length: 6 }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 300 + 200,
        color: [...COLORS[i % COLORS.length]] as [number, number, number],
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.4,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.004 + 0.001,
      }))

      // Flowing wave layers
      waves = [
        { offset: 0, speed: 0.0008, amplitude: 60, frequency: 0.003, color: [108, 142, 239], alpha: 0.04 },
        { offset: Math.PI, speed: 0.0006, amplitude: 80, frequency: 0.002, color: [167, 139, 250], alpha: 0.03 },
        { offset: Math.PI * 0.5, speed: 0.001, amplitude: 40, frequency: 0.004, color: [52, 211, 153], alpha: 0.025 },
      ]
    }

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const draw = () => {
      timeRef.current += 1
      const t = timeRef.current

      ctx.clearRect(0, 0, w, h)

      // === Flowing nebula waves ===
      for (const wave of waves) {
        wave.offset += wave.speed
        ctx.beginPath()
        ctx.moveTo(0, h)
        for (let x = 0; x <= w; x += 4) {
          const y = h * 0.5 +
            Math.sin(x * wave.frequency + wave.offset) * wave.amplitude +
            Math.sin(x * wave.frequency * 0.5 + wave.offset * 1.3) * wave.amplitude * 0.6 +
            Math.cos(x * wave.frequency * 0.3 + wave.offset * 0.7) * wave.amplitude * 0.4
          ctx.lineTo(x, y)
        }
        ctx.lineTo(w, h)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.7)
        grad.addColorStop(0, `rgba(${wave.color.join(',')}, 0)`)
        grad.addColorStop(0.5, `rgba(${wave.color.join(',')}, ${wave.alpha})`)
        grad.addColorStop(1, `rgba(${wave.color.join(',')}, 0)`)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // === Aurora orbs — much more visible ===
      for (const orb of orbs) {
        orb.x += orb.vx
        orb.y += orb.vy
        orb.pulsePhase += orb.pulseSpeed

        // Bounce off edges softly
        if (orb.x < -orb.radius * 0.5) orb.vx = Math.abs(orb.vx)
        if (orb.x > w + orb.radius * 0.5) orb.vx = -Math.abs(orb.vx)
        if (orb.y < -orb.radius * 0.5) orb.vy = Math.abs(orb.vy)
        if (orb.y > h + orb.radius * 0.5) orb.vy = -Math.abs(orb.vy)

        // Mouse attraction — orbs drift slightly toward cursor
        const mx = mouseRef.current.x
        const my = mouseRef.current.y
        if (mx > 0 && my > 0) {
          const dx = mx - orb.x
          const dy = my - orb.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 50) {
            orb.vx += (dx / dist) * 0.003
            orb.vy += (dy / dist) * 0.003
          }
        }

        // Dampen orb velocity
        orb.vx *= 0.998
        orb.vy *= 0.998

        const pulse = Math.sin(orb.pulsePhase) * 0.3 + 0.7
        const alpha = 0.08 * pulse
        const r = orb.radius * (0.85 + Math.sin(orb.pulsePhase) * 0.15)

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r)
        grad.addColorStop(0, `rgba(${orb.color.join(',')}, ${alpha * 1.5})`)
        grad.addColorStop(0.3, `rgba(${orb.color.join(',')}, ${alpha})`)
        grad.addColorStop(0.6, `rgba(${orb.color.join(',')}, ${alpha * 0.4})`)
        grad.addColorStop(1, `rgba(${orb.color.join(',')}, 0)`)

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // === Mouse glow cursor ===
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      if (mx > 0 && my > 0) {
        const glowPulse = Math.sin(t * 0.03) * 0.3 + 0.7
        const glowR = 180 * glowPulse
        const glowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, glowR)
        glowGrad.addColorStop(0, `rgba(108, 142, 239, ${0.06 * glowPulse})`)
        glowGrad.addColorStop(0.4, `rgba(167, 139, 250, ${0.03 * glowPulse})`)
        glowGrad.addColorStop(1, 'rgba(108, 142, 239, 0)')
        ctx.fillStyle = glowGrad
        ctx.beginPath()
        ctx.arc(mx, my, glowR, 0, Math.PI * 2)
        ctx.fill()
      }

      // === Draw particles ===
      for (const p of particles) {
        p.pulsePhase += p.pulseSpeed
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        // Mouse repulsion
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150 * 0.6
          p.vx += (dx / dist) * force * 0.12
          p.vy += (dy / dist) * force * 0.12
        }

        // Damping
        p.vx *= 0.99
        p.vy *= 0.99

        const pulse = Math.sin(p.pulsePhase) * 0.5 + 0.5
        const alpha = p.alpha * (0.5 + pulse * 0.5)
        const r = p.radius * (0.8 + pulse * 0.4)

        // Particle glow
        if (r > 1.5) {
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3)
          glowGrad.addColorStop(0, `rgba(${p.color}, ${alpha * 0.4})`)
          glowGrad.addColorStop(1, `rgba(${p.color}, 0)`)
          ctx.fillStyle = glowGrad
          ctx.beginPath()
          ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color}, ${alpha})`
        ctx.fill()
      }

      // === Draw connections between nearby particles ===
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.1
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(108, 142, 239, ${alpha})`
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }

      // === Shooting stars (rare, random) ===
      if (Math.random() < 0.003) {
        const startX = Math.random() * w
        const startY = Math.random() * h * 0.4
        const angle = Math.PI * 0.15 + Math.random() * 0.3
        const len = 80 + Math.random() * 120
        const endX = startX + Math.cos(angle) * len
        const endY = startY + Math.sin(angle) * len

        const starGrad = ctx.createLinearGradient(startX, startY, endX, endY)
        starGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
        starGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)')
        starGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = starGrad
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    window.addEventListener('mousemove', handleMouse)
    resize()
    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
