export const HEALTH_PATHS = ['/health', '/api/health'] as const

export function isHealthPath(path: string | undefined): boolean {
  return path !== undefined && (HEALTH_PATHS as readonly string[]).includes(path)
}
