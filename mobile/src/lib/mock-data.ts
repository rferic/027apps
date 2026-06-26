import type { InspirationRequest, Comment } from '../../../apps/inspiration/native'

// ─── Inspiration Mock Data ─────────────────────────────────────────────────────

export const mockInspirationRequests: InspirationRequest[] = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    title: 'Dark mode for mobile app',
    description: 'Add a system-wide dark mode toggle that respects the user device preference and persists across sessions.',
    type: 'improvement',
    status: 'approved',
    app_slug: '027apps',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    vote_count: 42,
    comment_count: 8,
    user_has_voted: true,
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    title: 'Login screen crashes on Android 14',
    description: 'The app crashes immediately after tapping the login button on Android 14 devices. Stack trace points to biometric auth initialization.',
    type: 'bug',
    status: 'in_progress',
    app_slug: '027apps',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    vote_count: 15,
    comment_count: 4,
    user_has_voted: false,
  },
  {
    id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    title: 'Time tracking app for freelancers',
    description: 'A simple time tracker with project-based tagging, export to CSV, and Pomodoro integration.',
    type: 'new_app',
    status: 'reviewing',
    app_slug: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    vote_count: 89,
    comment_count: 23,
    user_has_voted: true,
  },
  {
    id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    title: 'Add push notifications for comments',
    description: 'Users should receive a push notification when someone comments on their idea or replies to their comment.',
    type: 'new_general_functionality',
    status: 'pending',
    app_slug: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    vote_count: 31,
    comment_count: 2,
    user_has_voted: false,
  },
  {
    id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
    title: 'PDF export for reports',
    description: 'Add ability to export inspiration reports as PDF with charts showing idea trends by type and status.',
    type: 'new_app_feature',
    status: 'completed',
    app_slug: '027apps',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    vote_count: 67,
    comment_count: 12,
    user_has_voted: true,
  },
  {
    id: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c',
    title: 'Weekly inspiration digest email',
    description: 'Send a weekly email with the top 5 most voted ideas, newest submissions, and ideas that moved status.',
    type: 'improvement',
    status: 'on_hold',
    app_slug: '027apps',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    vote_count: 23,
    comment_count: 5,
    user_has_voted: false,
  },
]

export const mockComments: Comment[] = [
  {
    id: 'c001',
    request_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    user_id: 'u001',
    body: 'This would be amazing! Dark mode is a must-have in 2026.',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    user: { display_name: 'Alice', avatar_url: null },
  },
  {
    id: 'c002',
    request_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    user_id: 'u002',
    body: 'I second this. Should follow system preference by default with a manual override.',
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    user: { display_name: 'Bob', avatar_url: null },
  },
  {
    id: 'c003',
    request_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    user_id: 'u003',
    body: 'Make sure it works with OLED screens — true black (#000) saves battery.',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    user: { display_name: 'Charlie', avatar_url: null },
  },
  {
    id: 'c004',
    request_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    user_id: 'u004',
    body: 'Would love a Pomodoro timer. Could it also integrate with Apple Watch?',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    user: { display_name: 'Diana', avatar_url: null },
  },
  {
    id: 'c005',
    request_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    user_id: 'u005',
    body: 'CSV export is key. Most freelancers need to send timesheets to clients.',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    user: { display_name: 'Eve', avatar_url: null },
  },
]

export function getMockCommentsForRequest(requestId: string): Comment[] {
  return mockComments.filter(c => c.request_id === requestId)
}

// ─── TODO Mock Data ───────────────────────────────────────────────────────────

export interface TodoItem {
  id: number
  title: string
  description: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  visibility: 'private' | 'public'
  created_at: string
  user_id: string
  group_id: string
}

// TODO: Replace with real API calls via getApiClient() when TODO endpoints are available
// Expected API: apiClient.admin.apps.todo.listAdminTodos(), etc.

export const mockTodos: TodoItem[] = [
  {
    id: 1,
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment.',
    completed: true,
    priority: 'high',
    visibility: 'public',
    created_at: '2026-06-20T10:00:00Z',
    user_id: 'user-1',
    group_id: 'group-1',
  },
  {
    id: 2,
    title: 'Design onboarding flow',
    description: 'Create wireframes and prototype for new user onboarding.',
    completed: false,
    priority: 'high',
    visibility: 'public',
    created_at: '2026-06-21T14:30:00Z',
    user_id: 'user-1',
    group_id: 'group-1',
  },
  {
    id: 3,
    title: 'Update API documentation',
    description: 'Document new endpoints for the v2 launch.',
    completed: false,
    priority: 'medium',
    visibility: 'public',
    created_at: '2026-06-22T09:15:00Z',
    user_id: 'user-2',
    group_id: 'group-1',
  },
  {
    id: 4,
    title: 'Fix mobile navigation bug',
    description: 'Tab bar is unresponsive after returning from a modal.',
    completed: false,
    priority: 'high',
    visibility: 'private',
    created_at: '2026-06-23T11:00:00Z',
    user_id: 'user-1',
    group_id: 'group-1',
  },
  {
    id: 5,
    title: 'Clean up unused dependencies',
    description: 'Run depcheck and remove packages no longer in use.',
    completed: false,
    priority: 'low',
    visibility: 'private',
    created_at: '2026-06-24T08:45:00Z',
    user_id: 'user-1',
    group_id: 'group-1',
  },
  {
    id: 6,
    title: 'Write unit tests for auth module',
    description: 'Cover login, register, and token refresh flows.',
    completed: false,
    priority: 'medium',
    visibility: 'public',
    created_at: '2026-06-25T16:20:00Z',
    user_id: 'user-2',
    group_id: 'group-1',
  },
  {
    id: 7,
    title: 'Research WebSocket library',
    description: 'Compare socket.io vs native WebSocket for real-time features.',
    completed: true,
    priority: 'low',
    visibility: 'public',
    created_at: '2026-06-18T13:00:00Z',
    user_id: 'user-1',
    group_id: 'group-1',
  },
]

export const todoIdCounter = { next: mockTodos.length + 1 }
