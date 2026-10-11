// Metadata and OpenGraph also need a URL when a local worktree has no .env.
export const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim() || 'http://localhost:3000'
