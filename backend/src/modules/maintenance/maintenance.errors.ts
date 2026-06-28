export class MaintenanceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'MaintenanceError'
  }
}
