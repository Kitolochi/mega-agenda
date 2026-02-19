import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Memory, MemoryTopic } from '../types'

interface Props {
  memories: Memory[]
  topics: MemoryTopic[]
  onSelectMemory: (id: string) => void
}

interface GraphNode {
  id: string
  label: string
  type: 'topic' | 'memory'
  color: string
  x: number
  y: number
  targetX: number
  targetY: number
  radius: number
  sourceType?: string
  memoryId?: string
  topicName?: string
}

interface GraphEdge {
  source: string
  target: string
}

const SOURCE_COLORS: Record<string, string> = {
  chat: '#60a5fa',
  cli_session: '#a78bfa',
  journal: '#34d399',
  task: '#fbbf24',
  ai_task: '#f87171',
  manual: '#c084fc',
}

function toScreen(
  wx: number, wy: number,
  scale: number, offsetX: number, offsetY: number
): [number, number] {
  return [wx * scale + offsetX, wy * scale + offsetY]
}

function toWorld(
  sx: number, sy: number,
  scale: number, offsetX: number, offsetY: number
): [number, number] {
  return [(sx - offsetX) / scale, (sy - offsetY) / scale]
}

export default function MemoryGraph({ memories, topics, onSelectMemory }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const animFrameRef = useRef<number>(0)
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const animProgressRef = useRef(1) // Start at 1 (complete) — only animate on real data changes
  const pulseRef = useRef(0)
  const hoveredRef = useRef<GraphNode | null>(null)
  const selectedRef = useRef<GraphNode | null>(null)
  const highlightedTopicRef = useRef<string | null>(null)
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null)
  const panRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)
  const lastFingerprintRef = useRef('')

  // State only for side panel (needs re-render)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // Stable fingerprint to detect actual data changes
  const fingerprint = useMemo(() => {
    return memories.map(m => m.id).join(',') + '|' + topics.map(t => t.name + t.color).join(',')
  }, [memories, topics])

  // Build graph data with radial layout — only when data actually changes
  useEffect(() => {
    if (memories.length === 0) {
      nodesRef.current = []
      edgesRef.current = []
      return
    }
    if (fingerprint === lastFingerprintRef.current) return
    lastFingerprintRef.current = fingerprint

    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const width = containerRef.current?.clientWidth || 600
    const height = containerRef.current?.clientHeight || 400
    const cx = width / 2
    const cy = height / 2

    const topicRadius = Math.min(width, height) * 0.28
    const memoryOrbitRadius = Math.min(width, height) * 0.1

    // Topic nodes arranged in a circle
    const topicMap = new Map<string, GraphNode>()
    topics.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / Math.max(topics.length, 1) - Math.PI / 2
      const node: GraphNode = {
        id: `topic-${t.name}`,
        label: t.name,
        type: 'topic',
        color: t.color,
        x: cx,
        y: cy,
        targetX: cx + Math.cos(angle) * topicRadius,
        targetY: cy + Math.sin(angle) * topicRadius,
        radius: Math.min(10 + t.memoryCount * 2, 22),
        topicName: t.name,
      }
      nodes.push(node)
      topicMap.set(t.name, node)
    })

    // Group memories by primary topic
    const topicGroups = new Map<string, Memory[]>()
    memories.forEach(m => {
      const primary = m.topics[0] || '__orphan'
      if (!topicGroups.has(primary)) topicGroups.set(primary, [])
      topicGroups.get(primary)!.push(m)
    })

    // Memory nodes orbit their primary topic
    memories.forEach(m => {
      const primary = m.topics[0] || '__orphan'
      const topicNode = topicMap.get(primary)
      const group = topicGroups.get(primary) || []
      const indexInGroup = group.indexOf(m)
      const groupSize = group.length

      let targetX: number, targetY: number
      if (topicNode) {
        const memAngle = (2 * Math.PI * indexInGroup) / Math.max(groupSize, 1)
        const orbitDist = memoryOrbitRadius + groupSize * 2
        targetX = topicNode.targetX + Math.cos(memAngle) * orbitDist
        targetY = topicNode.targetY + Math.sin(memAngle) * orbitDist
      } else {
        const angle = (2 * Math.PI * indexInGroup) / Math.max(groupSize, 1)
        targetX = cx + Math.cos(angle) * 40
        targetY = cy + Math.sin(angle) * 40
      }

      const node: GraphNode = {
        id: `mem-${m.id}`,
        label: m.title.length > 28 ? m.title.slice(0, 25) + '...' : m.title,
        type: 'memory',
        color: SOURCE_COLORS[m.sourceType] || '#a78bfa',
        x: cx,
        y: cy,
        targetX,
        targetY,
        radius: 4 + m.importance * 1.5,
        sourceType: m.sourceType,
        memoryId: m.id,
      }
      nodes.push(node)

      m.topics.forEach(t => {
        if (topicMap.has(t)) {
          edges.push({ source: node.id, target: `topic-${t}` })
        }
      })

      m.relatedMemoryIds.forEach(rid => {
        edges.push({ source: node.id, target: `mem-${rid}` })
      })
    })

    nodesRef.current = nodes
    edgesRef.current = edges
    animProgressRef.current = 0 // Trigger entrance animation
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
  }, [fingerprint, memories, topics])

  // Single stable render loop — no state dependencies
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const maybeCtx = canvas.getContext('2d')
    if (!maybeCtx) return
    const ctx: CanvasRenderingContext2D = maybeCtx

    let width = container.clientWidth
    let height = container.clientHeight

    const resize = () => {
      width = container.clientWidth
      height = container.clientHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }
    resize()

    const resizeObs = new ResizeObserver(resize)
    resizeObs.observe(container)

    let running = true

    function render() {
      if (!running) return

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const scale = scaleRef.current
      const offset = offsetRef.current
      const hovered = hoveredRef.current
      const selected = selectedRef.current
      const highlightedTopic = highlightedTopicRef.current

      ctx.clearRect(0, 0, width, height)

      if (nodes.length === 0) {
        animFrameRef.current = requestAnimationFrame(render)
        return
      }

      // Entrance animation: spiral outward from center
      if (animProgressRef.current < 1) {
        animProgressRef.current = Math.min(1, animProgressRef.current + 0.04)
        const t = animProgressRef.current
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        for (const node of nodes) {
          if (dragRef.current?.node === node) continue
          const startX = width / 2
          const startY = height / 2
          node.x = startX + (node.targetX - startX) * ease
          node.y = startY + (node.targetY - startY) * ease
        }
      }

      pulseRef.current += 0.04

      const nodeMap = new Map(nodes.map(n => [n.id, n]))

      // Draw edges as bezier curves
      for (const edge of edges) {
        const src = nodeMap.get(edge.source)
        const tgt = nodeMap.get(edge.target)
        if (!src || !tgt) continue

        const [sx, sy] = toScreen(src.x, src.y, scale, offset.x, offset.y)
        const [tx, ty] = toScreen(tgt.x, tgt.y, scale, offset.x, offset.y)

        const mx = (sx + tx) / 2
        const my = (sy + ty) / 2
        const dx = tx - sx
        const dy = ty - sy
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const curvature = len * 0.15
        const cpx = mx + (-dy / len) * curvature
        const cpy = my + (dx / len) * curvature

        const isHighlighted = highlightedTopic && (
          src.topicName === highlightedTopic || tgt.topicName === highlightedTopic ||
          edge.source === `topic-${highlightedTopic}` || edge.target === `topic-${highlightedTopic}`
        )

        const alpha = isHighlighted ? 0.25 : 0.08
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.quadraticCurveTo(cpx, cpy, tx, ty)
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`
        ctx.lineWidth = isHighlighted ? 1.5 : 0.8
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        const [sx, sy] = toScreen(node.x, node.y, scale, offset.x, offset.y)
        const r = node.radius * scale
        const isHovered = hovered?.id === node.id
        const isSelected = selected?.id === node.id
        const isTopicHighlighted = highlightedTopic && node.topicName === highlightedTopic

        if (node.type === 'topic') {
          // Glowing ring
          const gradient = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 1.5)
          gradient.addColorStop(0, node.color + '30')
          gradient.addColorStop(0.6, node.color + '15')
          gradient.addColorStop(1, node.color + '00')
          ctx.beginPath()
          ctx.arc(sx, sy, r * 1.5, 0, Math.PI * 2)
          ctx.fillStyle = gradient
          ctx.fill()

          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fillStyle = node.color + '25'
          ctx.fill()
          ctx.strokeStyle = isTopicHighlighted || isHovered ? node.color : node.color + 'aa'
          ctx.lineWidth = isTopicHighlighted || isHovered ? 2.5 : 1.8
          ctx.stroke()

          // Inner dot
          ctx.beginPath()
          ctx.arc(sx, sy, r * 0.3, 0, Math.PI * 2)
          ctx.fillStyle = node.color + '60'
          ctx.fill()

          // Label with background pill
          const fontSize = Math.max(9, 10 * scale)
          ctx.font = `bold ${fontSize}px system-ui`
          ctx.textAlign = 'center'
          const textWidth = ctx.measureText(node.label).width
          const pillY = sy + r + 10 * scale
          const pillPad = 4 * scale

          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          roundRect(ctx, sx - textWidth / 2 - pillPad, pillY - 7 * scale, textWidth + pillPad * 2, 14 * scale, 4 * scale)
          ctx.fill()

          ctx.fillStyle = node.color
          ctx.fillText(node.label, sx, pillY + 3 * scale)
        } else {
          // Memory node with soft glow
          ctx.save()
          ctx.shadowColor = node.color
          ctx.shadowBlur = isHovered || isSelected ? 12 : 6
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fillStyle = node.color + '90'
          ctx.fill()
          ctx.restore()

          // Pulse ring on hover/selected
          if (isHovered || isSelected) {
            const pulse = Math.sin(pulseRef.current) * 0.3 + 0.7
            ctx.beginPath()
            ctx.arc(sx, sy, r + 3 * scale * pulse, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(255,255,255,${0.4 * pulse})`
            ctx.lineWidth = 1.2
            ctx.stroke()

            // Label with contrast pill
            const fontSize = Math.max(8, 9 * scale)
            ctx.font = `${fontSize}px system-ui`
            ctx.textAlign = 'center'
            const tw = ctx.measureText(node.label).width
            const ly = sy - r - 8 * scale
            const pp = 3 * scale

            ctx.fillStyle = 'rgba(0,0,0,0.7)'
            roundRect(ctx, sx - tw / 2 - pp, ly - 6 * scale, tw + pp * 2, 12 * scale, 3 * scale)
            ctx.fill()

            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            ctx.fillText(node.label, sx, ly + 3 * scale)
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
      resizeObs.disconnect()
    }
  }, []) // No dependencies — runs once, reads all state from refs

  // Helper: rounded rect path
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  // Hit test in world coordinates
  const getNodeAtPos = useCallback((screenX: number, screenY: number): GraphNode | null => {
    const scale = scaleRef.current
    const offset = offsetRef.current
    const [wx, wy] = toWorld(screenX, screenY, scale, offset.x, offset.y)
    for (const node of [...nodesRef.current].reverse()) {
      const dx = wx - node.x
      const dy = wy - node.y
      const hitRadius = node.radius + 6 / scale
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node
      }
    }
    return null
  }, [])

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const oldScale = scaleRef.current
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.3, Math.min(3, oldScale * delta))

    offsetRef.current = {
      x: mouseX - (mouseX - offsetRef.current.x) * (newScale / oldScale),
      y: mouseY - (mouseY - offsetRef.current.y) * (newScale / oldScale),
    }
    scaleRef.current = newScale
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (panRef.current) {
      offsetRef.current = {
        x: panRef.current.startOffsetX + (x - panRef.current.startX),
        y: panRef.current.startOffsetY + (y - panRef.current.startY),
      }
      return
    }

    if (dragRef.current) {
      const [wx, wy] = toWorld(x, y, scaleRef.current, offsetRef.current.x, offsetRef.current.y)
      dragRef.current.node.x = wx - dragRef.current.offsetX
      dragRef.current.node.y = wy - dragRef.current.offsetY
      dragRef.current.node.targetX = dragRef.current.node.x
      dragRef.current.node.targetY = dragRef.current.node.y
      return
    }

    const node = getNodeAtPos(x, y)
    hoveredRef.current = node
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? 'pointer' : 'grab'
    }
  }, [getNodeAtPos])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPos(x, y)
    if (node) {
      const [wx, wy] = toWorld(x, y, scaleRef.current, offsetRef.current.x, offsetRef.current.y)
      dragRef.current = { node, offsetX: wx - node.x, offsetY: wy - node.y }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    } else {
      panRef.current = {
        startX: x,
        startY: y,
        startOffsetX: offsetRef.current.x,
        startOffsetY: offsetRef.current.y,
      }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    }
  }, [getNodeAtPos])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    panRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPos(x, y)

    if (node?.type === 'memory' && node.memoryId) {
      selectedRef.current = node
      setSelectedNode(node) // Trigger re-render for side panel
      highlightedTopicRef.current = null
    } else if (node?.type === 'topic' && node.topicName) {
      highlightedTopicRef.current = highlightedTopicRef.current === node.topicName ? null : node.topicName
      selectedRef.current = null
      setSelectedNode(null)
    } else {
      selectedRef.current = null
      setSelectedNode(null)
      highlightedTopicRef.current = null
    }
  }, [getNodeAtPos])

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPos(x, y)
    if (node?.type === 'memory' && node.memoryId) {
      onSelectMemory(node.memoryId)
    }
  }, [getNodeAtPos, onSelectMemory])

  if (memories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-[11px]">
        No memories to display in graph
      </div>
    )
  }

  const selectedMemory = selectedNode?.memoryId
    ? memories.find(m => m.id === selectedNode.memoryId)
    : null

  return (
    <div className="h-full flex">
      <div ref={containerRef} className="flex-1 relative bg-surface-0 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          className="w-full h-full"
          style={{ cursor: 'grab' }}
        />
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={() => { scaleRef.current = Math.min(3, scaleRef.current * 1.2) }}
            className="w-6 h-6 rounded-md bg-surface-2/80 hover:bg-surface-3 text-muted hover:text-white text-[13px] flex items-center justify-center transition-all"
          >+</button>
          <button
            onClick={() => { scaleRef.current = Math.max(0.3, scaleRef.current * 0.8) }}
            className="w-6 h-6 rounded-md bg-surface-2/80 hover:bg-surface-3 text-muted hover:text-white text-[13px] flex items-center justify-center transition-all"
          >-</button>
          <button
            onClick={() => { scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 } }}
            className="w-6 h-6 rounded-md bg-surface-2/80 hover:bg-surface-3 text-muted hover:text-white text-[9px] flex items-center justify-center transition-all"
            title="Reset view"
          >1:1</button>
        </div>
        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex gap-2 bg-surface-1/80 rounded-lg px-2 py-1">
          <span className="flex items-center gap-1 text-[8px] text-muted">
            <span className="w-2 h-2 rounded-full bg-accent-purple/40 border border-accent-purple" /> Topics
          </span>
          {Object.entries(SOURCE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-[8px] text-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color + '80' }} />
              {type === 'cli_session' ? 'CLI' : type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          ))}
        </div>
        {/* Hint */}
        <div className="absolute bottom-2 right-2 text-[8px] text-muted/40">
          Scroll to zoom · Drag to pan · Click topic to highlight
        </div>
      </div>

      {/* Side panel */}
      {selectedMemory && (
        <div className="w-56 bg-surface-1 border-l border-white/[0.06] p-3 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted uppercase tracking-wider">Memory Detail</span>
            <button onClick={() => { selectedRef.current = null; setSelectedNode(null) }} className="text-muted hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h3 className="text-[11px] font-medium text-white/90 mb-1">{selectedMemory.title}</h3>
          <p className="text-[10px] text-muted leading-relaxed mb-2">{selectedMemory.content}</p>
          {selectedMemory.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedMemory.topics.map(t => {
                const topic = topics.find(tp => tp.name === t)
                return (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 rounded-md text-[8px] font-medium"
                    style={{
                      backgroundColor: (topic?.color || '#a78bfa') + '20',
                      color: topic?.color || '#a78bfa'
                    }}
                  >{t}</span>
                )
              })}
            </div>
          )}
          <div className="text-[9px] text-muted/50 mb-2">
            {selectedMemory.sourceType} · {new Date(selectedMemory.createdAt).toLocaleDateString()}
            {selectedMemory.importance === 3 && ' · High importance'}
            {selectedMemory.importance === 1 && ' · Low importance'}
          </div>
          {selectedMemory.relatedMemoryIds.length > 0 && (
            <div className="mb-2">
              <span className="text-[9px] text-muted/60 block mb-1">Related ({selectedMemory.relatedMemoryIds.length})</span>
              {selectedMemory.relatedMemoryIds.map(rid => {
                const rel = memories.find(m => m.id === rid)
                return rel ? (
                  <button
                    key={rid}
                    onClick={() => {
                      const n = nodesRef.current.find(n => n.memoryId === rid)
                      if (n) { selectedRef.current = n; setSelectedNode(n) }
                    }}
                    className="block w-full text-left text-[9px] text-accent-blue/70 hover:text-accent-blue truncate mb-0.5"
                  >{rel.title}</button>
                ) : null
              })}
            </div>
          )}
          <button
            onClick={() => onSelectMemory(selectedMemory.id)}
            className="w-full px-2 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] text-muted hover:text-white transition-all"
          >
            Edit Memory
          </button>
        </div>
      )}
    </div>
  )
}
