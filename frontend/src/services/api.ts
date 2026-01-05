import type { AuthResponse, User, Idea, IdeaDetail, Department, DepartmentSummary, DepartmentTemplate, Notification, Invitation, UserBasic, Invoice, InvoiceItem, PendingInvoiceSummary, Blocker, BlockerType, BlockerStatus, BlockerPriority, BlockerDiscussion } from '../types';
import axios from 'axios';

// Use environment variable in production, proxy in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
  
  getCurrentUser: () =>
    api.get<User>('/auth/me'),
  
  register: (data: { username: string; email: string; password: string; role: string }) =>
    api.post<{ user: User }>('/auth/register', data),
};

// Ideas endpoints
export const ideasApi = {
  getAll: () =>
    api.get<Idea[]>('/ideas'),
  
  getById: (id: number) =>
    api.get<IdeaDetail>(`/ideas/${id}`),
  
  create: (data: { 
    flow_name: string;
    summary?: string;
    description?: string; 
    department_ids?: number[];
    time_save_per_week?: string;
    cost_per_year?: string;
    author?: string;
    idea_notes?: string;
    scribe_url?: string;
    reviewer_name?: string;
    price?: number;
    // Deprecated fields for backward compatibility
    use_case?: string;
    short_description?: string;
    department?: string;
    tags?: string;
  }) =>
    api.post<Idea>('/ideas', data),
  
  update: (id: number, data: Partial<Idea> & { department_ids?: number[] }) =>
    api.put<Idea>(`/ideas/${id}`, data),
  
  delete: (id: number) =>
    api.delete(`/ideas/${id}`),
  
  assign: (id: number, freelancerId: number) =>
    api.post<Idea>(`/ideas/${id}/assign`, { freelancerId }),
  
  selfAssign: (id: number) =>
    api.post<Idea>(`/ideas/${id}/self-assign`),
  
  unassign: (id: number) =>
    api.post<Idea>(`/ideas/${id}/unassign`),
  
  addComment: (id: number, comment: string) =>
    api.post(`/ideas/${id}/comments`, { comment }),
  
  getFreelancers: () =>
    api.get<User[]>('/ideas/users/freelancers'),

  getAdmins: () =>
    api.get<User[]>('/ideas/users/admins'),

  // Upload flow JSON for a template (single file - backward compatible)
  uploadFlowJson: (id: number, flowJson: string) =>
    api.post<Idea & { _flowCount?: number }>(`/ideas/${id}/flow-json`, { flow_json: flowJson }),

  // Upload multiple flow JSON files
  uploadFlowJsonMultiple: (id: number, flowJsons: string[], append = false) =>
    api.post<Idea & { _flowCount?: number }>(`/ideas/${id}/flow-json`, { 
      flow_jsons: flowJsons,
      append 
    }),

  // Download full reconstructed template (full Activepieces format with real flow name)
  downloadTemplate: (id: number) =>
    api.get<{
      filename: string;
      template: {
        name: string;
        type: string;
        summary: string;
        description: string;
        tags: Array<{ title: string; color: string }>;
        author: string;
        categories: string[];
        pieces: string[];
        status: string;
        blogUrl: string;
        metadata: null;
        flows: any[];
      };
    }>(`/ideas/${id}/download-template`),

  // Get publish preview (shows what would be sent to Public Library API)
  getPublishPreview: (id: number) =>
    api.get<{
      template_id: number;
      public_library_id: string | null;
      is_published: boolean;
      publish_request: {
        name: string;
        summary: string;
        description: string;
        tags: Array<{ title: string; color: string }>;
        blogUrl: string;
        author: string;
        categories: string[];
        type: string;
        flows: any[];
      };
    }>(`/ideas/${id}/publish-preview`),

  // Sync a published template with Public Library (force update)
  syncWithPublicLibrary: (id: number) =>
    api.post<{
      success: boolean;
      message: string;
      public_library_id: string;
    }>(`/ideas/${id}/sync-public-library`),

  // Delete from Public Library only (keeps template in local system)
  deleteFromPublicLibrary: (id: number) =>
    api.delete<{
      success: boolean;
      message: string;
      previous_public_library_id: string;
    }>(`/ideas/${id}/public-library`),

  // Delete a template (also removes from Public Library if published)
  deleteTemplate: (id: number) =>
    api.delete<{
      message: string;
      deletedRecords: {
        blockers: number;
        idea: number;
        publicLibraryDeleted: boolean;
      };
    }>(`/ideas/${id}`),

  // Quick publish - create and publish template in one step
  quickPublish: (data: {
    flow_name: string;
    summary?: string;
    description?: string;
    department_ids?: number[];
    time_save_per_week?: string;
    cost_per_year?: string;
    author?: string;
    idea_notes?: string;
    scribe_url?: string;
    reviewer_name?: string;
    price?: number;
    assigned_to?: number;
    flow_json: string;
  }) =>
    api.post<Idea & {
      _flowCount: number;
      _publishedToLibrary: boolean;
      _publishError?: string;
    }>('/ideas/quick-publish', data),

  // Admin: Preview format changes (dry run)
  previewFormatSync: () =>
    api.get<{
      success: boolean;
      stats: {
        total: number;
        needsUpdate: number;
        alreadyCorrect: number;
        publishedNeedsUpdate: number;
      };
      needsUpdate: Array<{
        id: number;
        flow_name: string;
        time_save_per_week: { current: string; normalized: string | null };
        cost_per_year: { current: string; normalized: string | null };
        isPublished: boolean;
      }>;
      alreadyCorrect: Array<{
        id: number;
        flow_name: string;
        time_save_per_week: string;
        cost_per_year: string;
        isPublished: boolean;
      }>;
    }>('/ideas/admin/sync-formats/preview'),

  // Admin: Sync/normalize all template formats (also updates Public Library)
  syncFormats: () =>
    api.post<{
      success: boolean;
      message: string;
      stats: {
        total: number;
        updated: number;
        skipped: number;
        publicLibrarySynced: number;
        publicLibraryErrors: number;
      };
      changes: Array<{
        id: number;
        flow_name: string;
        time_save_per_week: { from: string; to: string } | null;
        cost_per_year: { from: string; to: string } | null;
        public_library_synced: boolean;
        public_library_error?: string;
      }>;
    }>('/ideas/admin/sync-formats'),

  // Admin: Sync published templates (already in Public Library) - UPDATE ONLY, no new creations
  syncAllToPublicLibrary: () =>
    api.post<{
      success: boolean;
      message: string;
      stats: {
        total: number;
        synced: number;
        skippedValidation: number;
        errors: number;
        notInLibrary: number;
      };
      details: Array<{
        id: number;
        flow_name: string;
        action: 'updated' | 'skipped' | 'error';
        public_library_id?: string;
        reason?: string;
        error?: string;
      }>;
    }>('/ideas/admin/sync-all-public-library'),
};

// Departments endpoints
export const departmentsApi = {
  getAll: () =>
    api.get<Department[]>('/departments'),
};

// Department Views endpoints
export const viewsApi = {
  getDepartments: () =>
    api.get<DepartmentSummary[]>('/views/departments'),
  
  getDepartmentTemplates: (department: string) =>
    api.get<DepartmentTemplate[]>(`/views/departments/${encodeURIComponent(department)}/templates`),
};

// Notifications endpoints
export const notificationsApi = {
  getAll: () =>
    api.get<Notification[]>('/notifications'),
  
  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count'),
  
  markAsRead: (id: number) =>
    api.put(`/notifications/${id}/read`),
  
  markAllAsRead: () =>
    api.put('/notifications/mark-all-read'),
  
  delete: (id: number) =>
    api.delete(`/notifications/${id}`),
  
  clearAll: () =>
    api.delete('/notifications'),
};

// Invitations endpoints
export const invitationsApi = {
  getAll: () =>
    api.get<Invitation[]>('/auth/invitations'),
  
  create: (email: string, role: string) =>
    api.post<{ invitation: Invitation }>('/auth/invitations', { email, role }),
  
  check: (token: string) =>
    api.get<{ email: string; role: string }>(`/auth/invitations/check/${token}`),
  
  accept: (token: string, username: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/invitations/accept', { token, username, password }),
  
  delete: (id: number) =>
    api.delete(`/auth/invitations/${id}`),
};

// Users endpoints (for mentions)
export const usersApi = {
  getAll: () =>
    api.get<UserBasic[]>('/auth/users'),
};

// Invoice endpoints
export const invoicesApi = {
  getPending: () =>
    api.get<PendingInvoiceSummary[]>('/invoices/pending'),
  
  getPendingForFreelancer: (freelancerId: number) =>
    api.get<{ items: InvoiceItem[]; summary: any }>(`/invoices/pending/${freelancerId}`),
  
  generateInvoice: (freelancerId: number) =>
    api.post<{ invoice: Invoice; csv: string; pdfHtml: string; freelancer: any }>(`/invoices/generate/${freelancerId}`),
  
  getHistory: (freelancerId?: number, limit?: number) =>
    api.get<Invoice[]>('/invoices/history', { params: { freelancerId, limit } }),
  
  getDetails: (invoiceId: number) =>
    api.get<{ invoice: Invoice; items: InvoiceItem[] }>(`/invoices/${invoiceId}`),
  
  revertInvoice: (invoiceId: number) =>
    api.post<{ success: boolean; message: string; itemsReverted: number }>(`/invoices/${invoiceId}/revert`),
};

// Blockers endpoints
export const blockersApi = {
  getForIdea: (ideaId: number, includeResolved = false) =>
    api.get<Blocker[]>(`/blockers/idea/${ideaId}`, { params: { includeResolved } }),
  
  getAll: (status?: string) =>
    api.get<Blocker[]>('/blockers/all', { params: { status } }),
  
  getOpen: () =>
    api.get<Blocker[]>('/blockers/open'),
  
  getByType: (type: BlockerType) =>
    api.get<Blocker[]>(`/blockers/type/${type}`),
  
  create: (data: {
    idea_id: number;
    blocker_type: BlockerType;
    title: string;
    description: string;
    priority?: BlockerPriority;
  }) =>
    api.post<Blocker>('/blockers', data),
  
  update: (id: number, data: Partial<{
    blocker_type: BlockerType;
    title: string;
    description: string;
    status: BlockerStatus;
    priority: BlockerPriority;
    resolution_notes: string;
  }>) =>
    api.put<Blocker>(`/blockers/${id}`, data),
  
  delete: (id: number) =>
    api.delete(`/blockers/${id}`),
  
  getStats: () =>
    api.get<any>('/blockers/stats/summary'),
  
  // Discussions
  getDiscussions: (blockerId: number) =>
    api.get<BlockerDiscussion[]>(`/blockers/${blockerId}/discussions`),
  
  addDiscussion: (blockerId: number, message: string, isSolution = false) =>
    api.post<BlockerDiscussion>(`/blockers/${blockerId}/discussions`, { message, is_solution: isSolution }),
  
  deleteDiscussion: (discussionId: number) =>
    api.delete(`/blockers/discussions/${discussionId}`),
};

// Analytics endpoints
export const analyticsApi = {
  getFreelancerReport: (period: 'weekly' | 'monthly' | 'all' = 'monthly', freelancerId?: number) =>
    api.get<{
      period: string;
      reports: Array<{
        freelancer_id: number;
        username: string;
        email: string;
        total_templates: number;
        published: number;
        reviewed: number;
        submitted: number;
        in_progress: number;
        needs_fixes: number;
        assigned: number;
        total_earnings: number;
        completed_earnings: number;
      }>;
      generated_at: string;
    }>('/analytics/freelancer-report', { params: { period, freelancerId } }),
  
  getCreationRate: (period: 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly') =>
    api.get<{
      period: string;
      creation_over_time: Array<{ date: string; created: number; published: number }>;
      status_distribution: Array<{ status: string; count: number }>;
      top_freelancers: Array<{ username: string; templates_count: number; published_count: number }>;
      generated_at: string;
    }>('/analytics/creation-rate', { params: { period } }),
  
  getSummary: () =>
    api.get<{
      overall: {
        total_templates: number;
        published: number;
        reviewed: number;
        in_progress: number;
        new_templates: number;
        total_value: number;
      };
      this_month: { created: number; published: number };
      last_month: { created: number; published: number };
      active_freelancers: number;
      total_freelancers: number;
      month_over_month_growth: string;
      generated_at: string;
    }>('/analytics/summary'),
  
  getDepartmentAnalytics: () =>
    api.get<{
      departments: Array<{
        department: string;
        template_count: number;
        published: number;
        in_progress: number;
      }>;
      generated_at: string;
    }>('/analytics/departments'),

  getIncompletePublished: () =>
    api.get<{
      count: number;
      templates: Array<{
        id: number;
        flow_name: string;
        summary: string | null;
        description: string | null;
        time_save_per_week: string | null;
        cost_per_year: string | null;
        author: string | null;
        scribe_url: string | null;
        template_url: string | null;
        flow_json: string | null;
        status: string;
        created_at: string;
        updated_at: string;
        missing_fields: string[];
        missing_count: number;
        assigned_to: number | null;
        assigned_username: string | null;
        assigned_email: string | null;
      }>;
      generated_at: string;
    }>('/analytics/incomplete-published'),

  getMaintenanceData: () =>
    api.get<{
      stale_assigned: Array<{
        id: number;
        flow_name: string;
        status: string;
        assigned_to: number;
        assigned_username: string;
        updated_at: string;
        days_since_update: number;
      }>;
      no_departments: Array<{
        id: number;
        flow_name: string;
        status: string;
        created_at: string;
      }>;
      no_flow_json: Array<{
        id: number;
        flow_name: string;
        status: string;
        created_at: string;
      }>;
      duplicates: Array<{
        flow_name: string;
        count: number;
        templates: Array<{
          id: number;
          status: string;
          created_at: string;
        }>;
      }>;
      generated_at: string;
    }>('/analytics/maintenance'),

  sendReminder: (userId: number, ideaId: number, reminderType: string, message?: string) =>
    api.post<{ success: boolean; message: string }>('/analytics/send-reminder', {
      user_id: userId,
      idea_id: ideaId,
      reminder_type: reminderType,
      message,
    }),

  sendBulkReminders: (reminders: Array<{ user_id: number; idea_id: number; reminder_type: string; message?: string }>) =>
    api.post<{ success: boolean; message: string; results: { sent: number; failed: number } }>('/analytics/send-bulk-reminders', {
      reminders,
    }),
};

export default api;

