import { useState, useEffect, useCallback, useMemo } from 'react'
import { ContextFile } from '../types'

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

export default function MemoryTab() {
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [showContextForm, setShowContextForm] = useState(false)
  const [ctxFileName, setCtxFileName] = useState('')
  const [ctxFileContent, setCtxFileContent] = useState('')
  const [editingContextFile, setEditingContextFile] = useState<string | null>(null)
  const [deletingContextFile, setDeletingContextFile] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState('')
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const ctxFiles = await window.electronAPI.getContextFiles()
    setContextFiles(ctxFiles)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Breadcrumb segments from currentFolder
  const breadcrumbs = useMemo(() => {
    if (!currentFolder) return []
    return currentFolder.split('/').filter(Boolean)
  }, [currentFolder])

  // Items visible in the current folder
  const visibleItems = useMemo(() => {
    return contextFiles.filter(f => f.folder === currentFolder)
  }, [contextFiles, currentFolder])

  const directories = useMemo(() => visibleItems.filter(f => f.isDirectory).sort((a, b) => a.name.localeCompare(b.name)), [visibleItems])
  const files = useMemo(() => visibleItems.filter(f => !f.isDirectory).sort((a, b) => a.name.localeCompare(b.name)), [visibleItems])

  // Count children inside a directory
  const countChildren = useCallback((folderPath: string) => {
    return contextFiles.filter(f => f.folder === folderPath && !f.isDirectory).length
  }, [contextFiles])

  const totalFileCount = useMemo(() => contextFiles.filter(f => !f.isDirectory).length, [contextFiles])

  const navigateToFolder = (folder: string) => {
    setCurrentFolder(folder)
    setExpandedFile(null)
    setDeletingContextFile(null)
    setDeletingFolder(null)
  }

  const navigateUp = () => {
    if (!currentFolder) return
    const parts = currentFolder.split('/')
    parts.pop()
    navigateToFolder(parts.join('/'))
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index < 0) {
      navigateToFolder('')
    } else {
      const parts = currentFolder.split('/').filter(Boolean)
      navigateToFolder(parts.slice(0, index + 1).join('/'))
    }
  }

  // Get relative path for a file (folder + name)
  const getRelativePath = (file: ContextFile) => {
    return file.folder ? `${file.folder}/${file.name}` : file.name
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-display font-semibold text-white/90">Context Files</h2>
            <p className="text-[10px] text-muted">{totalFileCount} files · ~/.claude/memory/</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              const uploaded = await window.electronAPI.uploadContextFiles(currentFolder)
              if (uploaded.length > 0) await loadData()
            }}
            className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-[10px] font-medium text-muted hover:text-white transition-all"
            title="Upload files into current folder"
          >
            Upload
          </button>
          <button
            onClick={() => {
              setShowFolderForm(true)
              setNewFolderName('')
            }}
            className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-[10px] font-medium text-muted hover:text-white transition-all"
          >
            + Folder
          </button>
          <button
            onClick={() => {
              setShowContextForm(true)
              setEditingContextFile(null)
              setCtxFileName('')
              setCtxFileContent('')
            }}
            className="px-2.5 py-1.5 rounded-lg bg-accent-blue/20 hover:bg-accent-blue/30 text-[10px] font-medium text-accent-blue transition-all"
          >
            + New File
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {currentFolder && (
        <div className="flex items-center gap-1 mb-3 text-[10px] flex-wrap">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="text-accent-blue hover:text-accent-blue/80 transition-colors font-medium"
          >
            root
          </button>
          {breadcrumbs.map((segment, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-muted/40">/</span>
              {i < breadcrumbs.length - 1 ? (
                <button
                  onClick={() => navigateToBreadcrumb(i)}
                  className="text-accent-blue hover:text-accent-blue/80 transition-colors font-medium"
                >
                  {segment}
                </button>
              ) : (
                <span className="text-white/70 font-medium">{segment}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* New Folder form */}
      {showFolderForm && (
        <div className="mb-3 p-2.5 bg-surface-2 rounded-xl border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-accent-blue/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="folder-name"
              autoFocus
              onKeyDown={async e => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  const folderPath = currentFolder ? `${currentFolder}/${newFolderName.trim()}` : newFolderName.trim()
                  await window.electronAPI.createContextFolder(folderPath)
                  setShowFolderForm(false)
                  setNewFolderName('')
                  await loadData()
                } else if (e.key === 'Escape') {
                  setShowFolderForm(false)
                }
              }}
              className="flex-1 bg-surface-3 border border-white/[0.06] rounded-md px-2 py-1 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-blue/40"
            />
            <button
              onClick={async () => {
                if (!newFolderName.trim()) return
                const folderPath = currentFolder ? `${currentFolder}/${newFolderName.trim()}` : newFolderName.trim()
                await window.electronAPI.createContextFolder(folderPath)
                setShowFolderForm(false)
                setNewFolderName('')
                await loadData()
              }}
              disabled={!newFolderName.trim()}
              className="px-2 py-1 rounded-md bg-accent-blue/20 hover:bg-accent-blue/30 text-[9px] font-medium text-accent-blue transition-all disabled:opacity-30"
            >
              Create
            </button>
            <button
              onClick={() => setShowFolderForm(false)}
              className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit file form */}
      {showContextForm && (
        <div className="mb-4 p-3 bg-surface-2 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-white/80">{editingContextFile ? 'Edit Context File' : 'New Context File'}</span>
            <button onClick={() => { setShowContextForm(false); setEditingContextFile(null) }} className="text-muted hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-white/70 flex-shrink-0">Filename:</span>
            <input
              value={ctxFileName}
              onChange={e => setCtxFileName(e.target.value)}
              placeholder="my-notes.md"
              disabled={!!editingContextFile}
              className="flex-1 bg-surface-3 border border-white/[0.06] rounded-md px-2 py-1 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-blue/40 disabled:opacity-50"
            />
          </div>
          {currentFolder && !editingContextFile && (
            <div className="text-[9px] text-muted/60 mb-2 pl-1">
              Will be saved in: ~/.claude/memory/{currentFolder}/
            </div>
          )}
          <textarea
            value={ctxFileContent}
            onChange={e => setCtxFileContent(e.target.value)}
            placeholder="Write your context notes here..."
            rows={6}
            className="w-full bg-surface-3 border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-blue/40 resize-none font-mono mb-2"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => { setShowContextForm(false); setEditingContextFile(null) }}
              className="px-2.5 py-1 rounded-md bg-surface-3 hover:bg-surface-4 text-[9px] text-muted hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const name = ctxFileName.trim()
                if (!name) return
                // When editing, use the file's original folder; when creating, use currentFolder
                const folder = editingContextFile
                  ? (contextFiles.find(f => f.name === editingContextFile)?.folder || '')
                  : currentFolder
                await window.electronAPI.saveContextFile(name, ctxFileContent, folder)
                setShowContextForm(false)
                setEditingContextFile(null)
                setCtxFileName('')
                setCtxFileContent('')
                await loadData()
              }}
              disabled={!ctxFileName.trim()}
              className="px-2.5 py-1 rounded-md bg-accent-blue/20 hover:bg-accent-blue/30 text-[9px] font-medium text-accent-blue transition-all disabled:opacity-30"
            >
              {editingContextFile ? 'Save Changes' : 'Create File'}
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {/* Back / up-directory entry */}
        {currentFolder && (
          <button
            onClick={navigateUp}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2/60 transition-all mb-1 text-left"
          >
            <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[11px] text-muted">..</span>
          </button>
        )}

        {directories.length > 0 || files.length > 0 ? (
          <div className="space-y-1">
            {/* Directories first */}
            {directories.map(dir => {
              const dirRelPath = dir.folder ? `${dir.folder}/${dir.name}` : dir.name
              const childCount = countChildren(dirRelPath)
              const isDeleting = deletingFolder === dir.name
              return (
                <div key={`dir-${dirRelPath}`} className="rounded-lg border border-white/[0.04] bg-surface-1/30 overflow-hidden group/file">
                  <div
                    onClick={() => navigateToFolder(dirRelPath)}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-2/60 transition-all"
                  >
                    <svg className="w-3.5 h-3.5 text-accent-blue/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className="text-[11px] font-medium text-white/80 flex-shrink-0">{dir.name}</span>
                    <span className="text-[9px] text-muted/50 flex-1">{childCount} file{childCount !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                      <button
                        onClick={async e => {
                          e.stopPropagation()
                          if (isDeleting) {
                            const success = await window.electronAPI.deleteContextFolder(dirRelPath)
                            if (!success) {
                              // folder not empty — could show feedback, but the button just won't work
                            }
                            setDeletingFolder(null)
                            await loadData()
                          } else {
                            setDeletingFolder(dir.name)
                            setTimeout(() => setDeletingFolder(null), 3000)
                          }
                        }}
                        className={`p-1 rounded transition-all ${isDeleting ? 'bg-accent-red/15 text-accent-red' : 'hover:bg-surface-3 text-muted hover:text-accent-red'}`}
                        title={isDeleting ? 'Click again to confirm (empty folders only)' : 'Delete folder'}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <svg className="w-3 h-3 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )
            })}

            {/* Files */}
            {files.map(file => {
              const fileKey = getRelativePath(file)
              const isExpanded = expandedFile === fileKey
              const preview = file.content ? file.content.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').slice(0, 120) : `(${formatFileSize(file.size)})`
              const isDeleting = deletingContextFile === fileKey
              return (
                <div key={`file-${fileKey}`} className="rounded-lg border border-white/[0.04] bg-surface-1/30 overflow-hidden group/file">
                  <div
                    onClick={() => setExpandedFile(isExpanded ? null : fileKey)}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-2/60 transition-all"
                  >
                    <span className="text-[11px] font-medium text-white/80 flex-shrink-0">{file.name}</span>
                    <span className="text-[9px] text-muted/50 truncate flex-1">{!isExpanded && preview}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                      {file.content !== undefined && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditingContextFile(file.name)
                            setCtxFileName(file.name)
                            setCtxFileContent(file.content)
                            setShowContextForm(true)
                          }}
                          className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
                          title="Edit"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={async e => {
                          e.stopPropagation()
                          if (isDeleting) {
                            await window.electronAPI.deleteContextFile(fileKey)
                            setDeletingContextFile(null)
                            if (expandedFile === fileKey) setExpandedFile(null)
                            await loadData()
                          } else {
                            setDeletingContextFile(fileKey)
                            setTimeout(() => setDeletingContextFile(null), 3000)
                          }
                        }}
                        className={`p-1 rounded transition-all ${isDeleting ? 'bg-accent-red/15 text-accent-red' : 'hover:bg-surface-3 text-muted hover:text-accent-red'}`}
                        title={isDeleting ? 'Click again to confirm' : 'Delete'}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <span className="text-[9px] text-muted/40 flex-shrink-0">
                      {new Date(file.modifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <svg className={`w-3 h-3 text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] px-4 py-3 max-h-64 overflow-auto">
                      {file.content ? (
                        <pre className="text-[10px] text-white/70 whitespace-pre-wrap leading-relaxed font-mono">{file.content}</pre>
                      ) : (
                        <div className="text-[10px] text-muted/60 italic">Binary file · {formatFileSize(file.size)}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : !showContextForm && !showFolderForm ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-accent-blue/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-white/80 mb-1">
              {currentFolder ? 'Empty folder' : 'No context files yet'}
            </h3>
            <p className="text-[11px] text-muted mb-3 max-w-[300px]">
              {currentFolder
                ? 'This folder is empty. Create a new file, upload files, or add a subfolder.'
                : 'Context files provide knowledge and instructions for your AI assistant. Click "+ New File" to create one.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
