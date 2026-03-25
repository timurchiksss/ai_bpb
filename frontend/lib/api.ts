const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

interface FetchOptions extends RequestInit {
  body?: any;
}

export async function fetchAPI<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  // Handle 204 No Content responses (empty body)
  if (response.status === 204) {
    return {} as T;
  }

  // Try to parse JSON, but handle empty responses gracefully
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const authAPI = {
  login: (email: string, password: string) =>
    fetchAPI('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (email: string, password: string) =>
    fetchAPI('/auth/register', {
      method: 'POST',
      body: { email, password },
    }),

  registerRequest: (email: string, password: string, phone_number: string) =>
    fetchAPI('/auth/register-request', {
      method: 'POST',
      body: { email, password, phone_number },
    }),

  logout: () =>
    fetchAPI('/auth/logout', {
      method: 'POST',
    }),

  me: () =>
    fetchAPI<{ id: string; email: string; is_admin: boolean; created_at: string }>('/auth/me', {
      method: 'GET',
    }),
};

// Company API types
export interface Company {
  id: string;
  user_id: string;
  name: string;
  type: string;  // "ИП" or "ТОО"
  bin: string;  // 12 digits
  oked_codes: string[];
  created_at: string;
  updated_at: string;
}

// Business Plan API types
export interface BusinessPlan {
  id: string;
  company_id: string;
  title: string;
  user_content: string;  // Source of truth - user's accepted version
  llm_content: string;  // LLM's version for current run
  priority_activities: string[];
  participation_period_years: number;
  planned_submission_year: number;
  created_at: string;
  updated_at: string;
}

// Admin Business Plan API types (includes user and company info)
export interface BusinessPlanAdmin extends BusinessPlan {
  user_email: string;
  company_name: string;
}

// Business Plan Config types
export interface BusinessPlanConfig {
  oked_classifier: any[];  // Hierarchical OKED structure
  priority_activities: string[];  // List of 19 priority activities
}

// Chat API types
export interface Chat {
  id: string;
  user_id: string;
  business_plan_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  id: string;
  tool_name: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  tool_calls?: ToolCall[];
}

export interface MessageChunk {
  type: 'response' | 'tool_start' | 'tool_end' | 'business_plan_update';
  content?: string | null;
}

// Model API types
export interface ModelsResponse {
  model_types: string[];
}

// Chat API functions
export const chatAPI = {
  // Models
  listModels: () =>
    fetchAPI<ModelsResponse>('/chat/models', {
      method: 'GET',
    }),

  // Chats
  createChat: (title: string, businessPlanId: string) =>
    fetchAPI<Chat>('/chat', {
      method: 'POST',
      body: { title, business_plan_id: businessPlanId },
    }),

  listChats: (businessPlanId?: string) => {
    const params = businessPlanId ? `?business_plan_id=${businessPlanId}` : '';
    return fetchAPI<{ chats: Chat[] }>(`/chat${params}`, {
      method: 'GET',
    });
  },

  getChat: (chatId: string) =>
    fetchAPI<Chat>(`/chat/${chatId}`, {
      method: 'GET',
    }),

  updateChat: (chatId: string, title: string) =>
    fetchAPI<Chat>(`/chat/${chatId}`, {
      method: 'PUT',
      body: { title },
    }),

  deleteChat: (chatId: string) =>
    fetchAPI(`/chat/${chatId}`, {
      method: 'DELETE',
    }),

  // Messages
  listMessages: (chatId: string, limit = 50, offset = 0, sortBy = 'created_at', sortDirection = 'desc') => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      sort_by: sortBy,
      sort_direction: sortDirection,
    });
    return fetchAPI<{ messages: Message[]; total: number; limit: number; offset: number }>(
      `/chat/${chatId}/messages?${params}`,
      {
        method: 'GET',
      }
    );
  },

  // Send message and stream response
  sendMessage: async function* (chatId: string, content: string, modelType: string): AsyncGenerator<MessageChunk, void, unknown> {
    const url = `${BACKEND_URL}/chat/${chatId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ content, model_type: modelType }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                const data = JSON.parse(jsonStr);
                yield data as MessageChunk;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                const data = JSON.parse(jsonStr);
                yield data as MessageChunk;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

// Company API functions
export const companyAPI = {
  getCompany: () =>
    fetchAPI<Company>('/company', {
      method: 'GET',
    }),

  createCompany: (name: string, type: string, bin: string, okedCodes: string[]) =>
    fetchAPI<Company>('/company', {
      method: 'POST',
      body: { name, type, bin, oked_codes: okedCodes },
    }),

  updateCompany: (name?: string, type?: string, bin?: string, okedCodes?: string[]) =>
    fetchAPI<Company>('/company', {
      method: 'PUT',
      body: { name, type, bin, oked_codes: okedCodes },
    }),
};

// Business Plan API functions
export const businessPlanAPI = {
  getConfig: () =>
    fetchAPI<BusinessPlanConfig>('/business-plan/config', {
      method: 'GET',
    }),

  createBusinessPlan: (title: string, companyId: string, priorityActivities: string[], participationPeriodYears: number, plannedSubmissionYear: number) =>
    fetchAPI<BusinessPlan>('/business-plan', {
      method: 'POST',
      body: { 
        title, 
        company_id: companyId, 
        priority_activities: priorityActivities,
        participation_period_years: participationPeriodYears,
        planned_submission_year: plannedSubmissionYear,
      },
    }),

  listBusinessPlans: () =>
    fetchAPI<{ business_plans: BusinessPlan[] }>('/business-plan', {
      method: 'GET',
    }),

  getBusinessPlan: (planId: string) =>
    fetchAPI<BusinessPlan>(`/business-plan/${planId}`, {
      method: 'GET',
    }),

  updateBusinessPlan: (planId: string, title?: string, priorityActivities?: string[], participationPeriodYears?: number, plannedSubmissionYear?: number, user_content?: string) =>
    fetchAPI<BusinessPlan>(`/business-plan/${planId}`, {
      method: 'PUT',
      body: { 
        title, 
        priority_activities: priorityActivities,
        participation_period_years: participationPeriodYears,
        planned_submission_year: plannedSubmissionYear,
        user_content 
      },
    }),

  deleteBusinessPlan: (planId: string) =>
    fetchAPI(`/business-plan/${planId}`, {
      method: 'DELETE',
    }),

  downloadBusinessPlan: async (planId: string, format: 'pdf' | 'docx'): Promise<Blob> => {
    const url = `${BACKEND_URL}/business-plan/${planId}/download/${format}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.blob();
  },
};

// Task API types
export interface TaskStatus {
  task_id: string;
  status: 'queued' | 'in_progress' | 'complete' | 'not_found' | 'deferred' | 'expired' | 'aborted';
  current_section: number;
  completed_sections: number[];
  total_sections: number;
  estimated_seconds_remaining: number;
  error: string | null;
  business_plan_id: string;
  created_at?: string;
}

// Task API functions
export const taskAPI = {
  generateDraft: (businessPlanId: string, formData: any, modelType: string) =>
    fetchAPI<{ task_id: string; status: string; business_plan_id: string }>(
      `/tasks/business-plans/${businessPlanId}/generate-draft?model_type=${encodeURIComponent(modelType)}`,
      {
        method: 'POST',
        body: formData,
      }
    ),

  getTaskStatus: (businessPlanId: string) =>
    fetchAPI<TaskStatus | null>(`/tasks/business-plans/${businessPlanId}/status`, {
      method: 'GET',
    }),

  cancelTask: (businessPlanId: string) =>
    fetchAPI<{ message: string; task_id: string; status: string; business_plan_id: string }>(
      `/tasks/business-plans/${businessPlanId}/cancel`,
      {
        method: 'DELETE',
      }
    ),
};

// Admin API functions
export const adminAPI = {
  listAllBusinessPlans: (userEmail?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (userEmail) {
      params.append('user_email', userEmail);
    }
    return fetchAPI<{ business_plans: BusinessPlanAdmin[]; total: number; limit: number; offset: number }>(`/admin/business-plans?${params}`, {
      method: 'GET',
    });
  },

  getBusinessPlan: (planId: string) =>
    fetchAPI<BusinessPlanAdmin>(`/admin/business-plans/${planId}`, {
      method: 'GET',
    }),
};
