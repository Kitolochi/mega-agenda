import type { Chunk } from '../../chunker'

/** Chunks spanning different domains — used for BM25 domain filter tests */
export const multiDomainChunks: Chunk[] = [
  {
    text: 'React hooks allow functional components to manage state and side effects without class components. The useState hook returns a state variable and setter function.',
    sourceFile: 'docs/react-hooks.md',
    heading: 'React Hooks Overview',
    domain: 'docs',
    fileHash: 'hash1',
    startLine: 1,
  },
  {
    text: 'TypeScript provides static type checking for JavaScript applications. Interfaces and type aliases help define the shape of data structures.',
    sourceFile: 'docs/typescript-basics.md',
    heading: 'TypeScript Fundamentals',
    domain: 'docs',
    fileHash: 'hash2',
    startLine: 1,
  },
  {
    text: 'Zustand is a lightweight state management library for React. It uses a simple create function to define stores that components subscribe to.',
    sourceFile: 'sessions/mega-agenda/abc123.jsonl',
    heading: 'State Management Discussion',
    domain: 'sessions/mega-agenda',
    fileHash: 'hash3',
    startLine: 0,
  },
  {
    text: 'Electron applications combine Chromium and Node.js to build cross-platform desktop apps. The main process manages windows and system resources.',
    sourceFile: 'sessions/mega-agenda/def456.jsonl',
    heading: 'Electron Architecture',
    domain: 'sessions/mega-agenda',
    fileHash: 'hash4',
    startLine: 0,
  },
  {
    text: 'Database indexing improves query performance by creating sorted data structures that allow faster lookups than full table scans.',
    sourceFile: 'sessions/other-project/ghi789.jsonl',
    heading: 'Database Optimization',
    domain: 'sessions/other-project',
    fileHash: 'hash5',
    startLine: 0,
  },
  {
    text: 'Vector search uses mathematical similarity between embedding vectors to find semantically related content regardless of exact keyword matches.',
    sourceFile: 'domains/search/vector-guide.md',
    heading: 'Vector Search Concepts',
    domain: 'search',
    fileHash: 'hash6',
    startLine: 1,
  },
  {
    text: 'BM25 is a probabilistic ranking function used in information retrieval to score documents against search queries based on term frequency.',
    sourceFile: 'domains/search/bm25-overview.md',
    heading: 'BM25 Algorithm',
    domain: 'search',
    fileHash: 'hash7',
    startLine: 1,
  },
  {
    text: 'Tailwind CSS is a utility-first CSS framework that provides low-level utility classes for building custom designs directly in markup.',
    sourceFile: 'docs/tailwind-guide.md',
    heading: 'Tailwind CSS Setup',
    domain: 'docs',
    fileHash: 'hash8',
    startLine: 1,
  },
  {
    text: 'The Vitest testing framework integrates tightly with Vite, sharing its configuration and transform pipeline for fast test execution.',
    sourceFile: 'docs/testing-guide.md',
    heading: 'Testing with Vitest',
    domain: 'docs',
    fileHash: 'hash9',
    startLine: 1,
  },
  {
    text: 'Reciprocal Rank Fusion combines multiple ranked result lists by summing inverse rank scores to produce a unified ranking that leverages both sources.',
    sourceFile: 'domains/search/rrf-explanation.md',
    heading: 'RRF Fusion Strategy',
    domain: 'search',
    fileHash: 'hash10',
    startLine: 1,
  },
]

/** Small chunk set for basic BM25 round-trip tests */
export const basicChunks: Chunk[] = [
  {
    text: 'JavaScript is a dynamic programming language commonly used for web development. It supports both object-oriented and functional programming paradigms.',
    sourceFile: 'notes/javascript.md',
    heading: 'JavaScript Basics',
    domain: 'notes',
    fileHash: 'jshash',
    startLine: 1,
  },
  {
    text: 'Python is a versatile programming language known for its readability and extensive standard library. It is widely used in data science and machine learning.',
    sourceFile: 'notes/python.md',
    heading: 'Python Overview',
    domain: 'notes',
    fileHash: 'pyhash',
    startLine: 1,
  },
  {
    text: 'Rust provides memory safety guarantees without garbage collection through its ownership and borrowing system. It excels at systems programming.',
    sourceFile: 'notes/rust.md',
    heading: 'Rust Language',
    domain: 'notes',
    fileHash: 'rshash',
    startLine: 1,
  },
]
