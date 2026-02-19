import { useState, useRef, useEffect, useCallback } from 'react'
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
  vx: number
  vy: number
  radius: number
  sourceType?: string
  memoryId?: string
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

export default function MemoryGraph({ memories, topics, onSelectMemory }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const animFrameRef = useRef<number>(0)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null)

  // Build graph data
  useEffect(() => {
    if (memories.length === 0) return

    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const width = containerRef.current?.clientWidth || 600
    const height = containerRef.current?.clientHeight || 400
    const cx = width / 2
    const cy = height / 2

    // Topic nodes (hubs)
    const topicMap = new Map<string, GraphNode>()
    topics.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / Math.max(topics.length, 1)
      const dist = Math.min(width, height) * 0.25
      const node: GraphNode = {
        id: `topic-${t.name}`,
        label: t.name,
        type: 'topic',
        color: t.color,
        x: cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 20,
        y: cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0,
        radius: Math.min(8 + t.memoryCount * 2, 20),
      }
      nodes.push(node)
      topicMap.set(t.name, node)
    })

    // Memory nodes
    memories.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / Math.max(memories.length, 1)
      const dist = Math.min(width, height) * 0.35 + (Math.random() - 0.5) * 40
      const node: GraphNode = {
        id: `mem-${m.id}`,
        label: m.title.length > 25 ? m.title.slice(0, 22) + '...' : m.title,
        type: 'memory',
        color: SOURCE_COLORS[m.sourceType] || '#a78bfa',
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        radius: 4 + m.importance,
        sourceType: m.sourceType,
        memoryId: m.id,
      }
      nodes.push(node)

      // Connect to topics
      m.topics.forEach(t => {
        const topicNode = topicMap.get(t)
        if (topicNode) {
          edges.push({ source: node.id, target: topicNode.id })
        }
      })

      // Connect related memories
      m.relatedMemoryIds.forEach(rid => {
        edges.push({ source: node.id, target: `mem-${rid}` })
      })
    })

    nodesRef.current = nodes
    edgesRef.current = edges
  }, [memories, topics])

  // Force simulation + render
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const maybeCtx = canvas.getContext('2d')
    if (!maybeCtx) return
    const ctx: CanvasRenderingContext2D = maybeCtx

    const resize = () => {
      canvas.width = container.clientWidth * window.devicePixelRatio
      canvas.height = container.clientHeight * window.devicePixelRatio
      canvas.style.width = container.clientWidth + 'px'
      canvas.style.height = container.clientHeight + 'px'
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()

    const width = container.clientWidth
    const height = container.clientHeight

    let ticks = 0
    const maxTicks = 200

    function simulate() {
      const nodes = nodesRef.current
      const edges = edgesRef.current
      if (nodes.length === 0) return

      if (ticks < maxTicks) {
        const alpha = 1 - ticks / maxTicks

        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x
            const dy = nodes[j].y - nodes[i].y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = (alpha * 500) / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            nodes[i].vx -= fx
            nodes[i].vy -= fy
            nodes[j].vx += fx
            nodes[j].vy += fy
          }
        }

        // Attraction along edges
        const nodeMap = new Map(nodes.map(n => [n.id, n]))
        for (const edge of edges) {
          const src = nodeMap.get(edge.source)
          const tgt = nodeMap.get(edge.target)
          if (!src || !tgt) continue
          const dx = tgt.x - src.x
          const dy = tgt.y - src.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = alpha * (dist - 80) * 0.01
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          src.vx += fx
          src.vy += fy
          tgt.vx -= fx
          tgt.vy -= fy
        }

        // Center gravity
        for (const node of nodes) {
          node.vx += (width / 2 - node.x) * alpha * 0.005
          node.vy += (height / 2 - node.y) * alpha * 0.005
        }

        // Apply velocity with damping
        for (const node of nodes) {
          if (dragRef.current && dragRef.current.node === node) continue
          node.vx *= 0.8
          node.vy *= 0.8
          node.x += node.vx
          node.y += node.vy
          // Bounds
          node.x = Math.max(node.radius, Math.min(width - node.radius, node.x))
          node.y = Math.max(node.radius, Math.min(height - node.radius, node.y))
        }

        ticks++
      }

      // Render
      ctx.clearRect(0, 0, width, height)

      // Draw edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      for (const edge of edges) {
        const src = nodeMap.get(edge.source)
        const tgt = nodeMap.get(edge.target)
        if (!src || !tgt) continue
        ctx.beginPath()
        ctx.moveTo(src.x, src.y)
        ctx.lineTo(tgt.x, tgt.y)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)

        if (node.type === 'topic') {
          ctx.fillStyle = node.color + '40'
          ctx.fill()
          ctx.strokeStyle = node.color
          ctx.lineWidth = 2
          ctx.stroke()
          // Label
          ctx.fillStyle = node.color
          ctx.font = 'bold 10px system-ui'
          ctx.textAlign = 'center'
          ctx.fillText(node.label, node.x, node.y + node.radius + 12)
        } else {
          ctx.fillStyle = node.color + '80'
          ctx.fill()
          const isHovered = hoveredNode?.id === node.id
          const isSelected = selectedNode?.id === node.id
          if (isHovered || isSelected) {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1.5
            ctx.stroke()
            // Show label on hover
            ctx.fillStyle = 'rgba(255,255,255,0.8)'
            ctx.font = '9px system-ui'
            ctx.textAlign = 'center'
            ctx.fillText(node.label, node.x, node.y - node.radius - 4)
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(simulate)
    }

    simulate()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [memories, topics, hoveredNode, selectedNode])

  // Mouse interactions
  const getNodeAtPos = useCallback((x: number, y: number): GraphNode | null => {
    for (const node of [...nodesRef.current].reverse()) {
      const dx = x - node.x
      const dy = y - node.y
      if (dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4)) {
        return node
      }
    }
    return null
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (dragRef.current) {
      dragRef.current.node.x = x - dragRef.current.offsetX
      dragRef.current.node.y = y - dragRef.current.offsetY
      return
    }

    const node = getNodeAtPos(x, y)
    setHoveredNode(node)
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? 'pointer' : 'default'
    }
  }, [getNodeAtPos])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPos(x, y)
    if (node) {
      dragRef.current = { node, offsetX: x - node.x, offsetY: y - node.y }
    }
  }, [getNodeAtPos])

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      const node = dragRef.current.node
      dragRef.current = null
      // If barely moved, treat as click
      if (node.type === 'memory' && node.memoryId) {
        setSelectedNode(node)
      }
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPos(x, y)
    if (node?.type === 'memory' && node.memoryId) {
      setSelectedNode(node)
    } else {
      setSelectedNode(null)
    }
  }, [getNodeAtPos])

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
          onClick={handleClick}
          className="w-full h-full"
        />
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
      </div>

      {/* Side panel */}
      {selectedMemory && (
        <div className="w-56 bg-surface-1 border-l border-white/[0.06] p-3 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted uppercase tracking-wider">Memory Detail</span>
            <button onClick={() => setSelectedNode(null)} className="text-muted hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h3 className="text-[11px] font-medium text-white/90 mb-1">{selectedMemory.title}</h3>
          <p className="text-[10px] text-muted leading-relaxed mb-2">{selectedMemory.content}</p>
          {selectedMemory.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedMemory.topics.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded-md bg-accent-purple/10 text-accent-purple text-[8px] font-medium">{t}</span>
              ))}
            </div>
          )}
          <div className="text-[9px] text-muted/50 mb-2">
            {selectedMemory.sourceType} · {new Date(selectedMemory.createdAt).toLocaleDateString()}
          </div>
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
