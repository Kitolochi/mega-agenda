/**
 * Electron mock patterns for vitest.
 *
 * Due to vi.mock hoisting, the electron mock must be inlined in each test file.
 * Use vi.hoisted() to create shared state accessible from the mock factory.
 *
 * @example
 * ```ts
 * import { createTempDir, cleanupTempDir } from './helpers/temp-dir'
 *
 * const mockElectronState = vi.hoisted(() => ({ userDataDir: '' }))
 *
 * vi.mock('electron', () => ({
 *   app: {
 *     getPath: vi.fn((_name: string) => mockElectronState.userDataDir),
 *   },
 * }))
 *
 * let tempDir: string
 *
 * beforeEach(() => {
 *   tempDir = createTempDir()
 *   mockElectronState.userDataDir = tempDir
 * })
 *
 * afterEach(() => {
 *   cleanupTempDir(tempDir)
 * })
 * ```
 */
export { createTempDir, cleanupTempDir } from './temp-dir'
