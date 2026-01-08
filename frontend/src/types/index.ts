export type UserRole = 'admin' | 'freelancer'; // 'freelancer' is displayed as 'Template Creator' in UI

export type IdeaStatus = 
  | 'new' 
  | 'assigned' 
  | 'in_progress' 
  | 'submitted' 
  | 'needs_fixes' 
  | 'reviewed' 
  | 'published'
  | 'archived';

// Valid template categories from Activepieces Public Library API
export type TemplateCategory = 
  | 'ANALYTICS'
  | 'COMMUNICATION'
  | 'CONTENT'
  | 'CUSTOMER_SUPPORT'
  | 'DEVELOPMENT'
  | 'E_COMMERCE'
  | 'FINANCE'
  | 'HR'
  | 'IT_OPERATIONS'
  | 'MARKETING'
  | 'PRODUCTIVITY'
  | 'SALES';

// All valid template categories
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'ANALYTICS',
  'COMMUNICATION',
  'CONTENT',
  'CUSTOMER_SUPPORT',
  'DEVELOPMENT',
  'E_COMMERCE',
  'FINANCE',
  'HR',
  'IT_OPERATIONS',
  'MARKETING',
  'PRODUCTIVITY',
  'SALES'
];

// Human-readable labels for template categories
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ANALYTICS: 'Analytics',
  COMMUNICATION: 'Communication',
  CONTENT: 'Content',
  CUSTOMER_SUPPORT: 'Customer Support',
  DEVELOPMENT: 'Development',
  E_COMMERCE: 'E-Commerce',
  FINANCE: 'Finance',
  HR: 'HR',
  IT_OPERATIONS: 'IT Operations',
  MARKETING: 'Marketing',
  PRODUCTIVITY: 'Productivity',
  SALES: 'Sales'
};

// Public Library template status
export type PublicLibraryStatus = 'PUBLISH' | 'ARCHIVED';

export interface User {
  id: number;
  username: string;
  email: string;
  handle: string;
  role: UserRole;
  created_at?: string;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  display_order: number;
}

export interface Idea {
  id: number;
  flow_name: string | null;
  summary: string | null; // Brief summary for public library
  description: string | null;
  setup_guide: string | null;
  template_url: string | null;
  scribe_url: string | null; // Sent as blogUrl to API
  time_save_per_week: string | null; // e.g., "2 hours"
  cost_per_year: string | null; // e.g., "$150/year"
  author: string | null; // Template author for public library
  idea_notes: string | null; // Internal notes about the template idea
  flow_json: string | null; // JSON string for flow data
  reviewer_name: string | null; // Internal only
  price: number; // Internal only
  status: IdeaStatus;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: number;
  created_by_name: string;
  public_library_id: string | null; // ID returned from publish API
  departments?: Department[]; // Array of departments
  fix_count?: number; // Number of times marked as needs_fixes (for resubmission tracking)
  created_at: string;
  updated_at: string;
  // Deprecated fields - kept for backward compatibility
  use_case?: string;
  short_description?: string | null;
  department?: string | null;
  tags?: string | null;
}

export interface IdeaDetail extends Idea {
  comments: Comment[];
  activities: Activity[];
}

export interface Comment {
  id: number;
  idea_id: number;
  user_id: number;
  username: string;
  handle?: string;
  comment: string;
  images?: string | string[]; // JSON string or array of image URLs
  edited_at?: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  idea_id: number;
  user_id: number;
  username: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Department View Types
export interface DepartmentSummary {
  department: string;
  template_count: number;
  published_count: number;
  in_progress_count: number;
  new_count: number;
  total_value: number;
  avg_price: number;
}

export interface DepartmentTemplate {
  id: number;
  department: string;
  flow_name: string | null;
  summary: string | null;
  status: IdeaStatus;
  price: number;
  assigned_to: string | null;
  fix_count?: number;
  created_at: string;
  updated_at: string;
  // Deprecated
  use_case?: string;
  short_description?: string | null;
}

// Notification types
export interface Notification {
  id: number;
  user_id: number;
  type: 'mention' | 'status_change' | 'assignment' | 'blocker';
  title: string;
  message: string;
  idea_id: number | null;
  from_user_id: number | null;
  from_username: string | null;
  from_handle: string | null;
  idea_title: string | null;
  idea_flow_name: string | null;
  read_at: string | null;
  created_at: string;
}

// Invitation types
export interface Invitation {
  id: number;
  email: string;
  token: string;
  role: UserRole;
  invited_by: number;
  invited_by_name: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface UserBasic {
  id: number;
  username: string;
  handle: string;
  role: UserRole;
}

// Invoice types
export interface InvoiceItem {
  id: number;
  invoice_id: number | null;
  freelancer_id: number;
  idea_id: number | null;
  idea_title: string;
  use_case?: string;
  flow_name?: string;
  department?: string;
  amount: number;
  completed_at: string;
  status: 'pending' | 'invoiced' | 'paid';
  is_manual?: boolean;
  created_at: string;
}

export interface Invoice {
  id: number;
  freelancer_id: number;
  freelancer_name?: string;
  freelancer_email?: string;
  invoice_number: string;
  total_amount: number;
  status: 'pending' | 'paid';
  period_start: string;
  period_end: string;
  paid_at: string | null;
  paid_by: number | null;
  paid_by_name?: string;
  created_at: string;
}

export interface PendingInvoiceSummary {
  freelancer_id: number;
  freelancer_name: string;
  freelancer_email: string;
  freelancer_handle: string;
  item_count: number;
  total_amount: number;
  period_start: string;
  period_end: string;
}

// Blocker types
export type BlockerType = 'missing_action' | 'missing_integration' | 'platform_limitation' | 'bug' | 'other';
export type BlockerStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';
export type BlockerPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Blocker {
  id: number;
  idea_id: number;
  blocker_type: BlockerType;
  title: string;
  description: string;
  status: BlockerStatus;
  priority: BlockerPriority;
  created_by: number;
  created_by_name?: string;
  created_by_handle?: string;
  resolved_by: number | null;
  resolved_by_name?: string;
  resolved_by_handle?: string;
  resolved_at: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  discussion_count?: number;
  // Additional fields when joined with ideas
  use_case?: string;
  flow_name?: string;
  department?: string;
  assigned_to?: number;
  assigned_to_name?: string;
}

export interface BlockerDiscussion {
  id: number;
  blocker_id: number;
  user_id: number;
  username: string;
  handle: string;
  role: UserRole;
  message: string;
  is_solution: boolean;
  created_at: string;
}

// Suggested Idea types
export type SuggestionStatus = 'pending' | 'approved' | 'denied';

export interface SuggestedIdea {
  id: number;
  flow_name: string;
  idea_notes: string | null;
  status: SuggestionStatus;
  suggested_by: number;
  suggested_by_name?: string;
  suggested_by_handle?: string;
  reviewed_by: number | null;
  reviewed_by_name?: string;
  reviewed_by_handle?: string;
  review_note: string | null;
  converted_idea_id: number | null;
  departments?: Department[];
  created_at: string;
  reviewed_at: string | null;
}

