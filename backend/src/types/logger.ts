export interface Logger {
  info(message: string | Record<string, unknown>): void
  error(message: string | Record<string, unknown>): void
}
