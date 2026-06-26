export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the current state. Please refresh and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again later.',
  502: 'The server is temporarily unavailable. Please try again soon.',
  503: 'Service is currently unavailable. Please try again later.',
}

export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  // ts-rest response error (status + body)
  if (error !== null && typeof error === 'object' && 'status' in error) {
    const { status, body } = error as { status: number; body: unknown }
    const message =
      body !== null && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : ERROR_MESSAGES[status] || `Request failed with status ${status}`
    return new ApiError(status, message)
  }

  // Network / fetch errors
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return new ApiError(0, 'No internet connection. Please check your network and try again.')
  }

  if (error instanceof Error) {
    const isNetworkError =
      error.message.includes('timeout') ||
      error.message.includes('abort') ||
      error.message.includes('network') ||
      error.message.includes('fetch')

    if (isNetworkError) {
      return new ApiError(0, 'Connection error. Please check your network and try again.')
    }

    return new ApiError(0, error.message)
  }

  return new ApiError(0, 'An unexpected error occurred. Please try again.')
}
