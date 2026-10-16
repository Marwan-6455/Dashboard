import { CONFIG } from '../config.js';

interface RequestOptions {
  method?: string;
  body?: any;
  query?: Record<string, string | undefined>;
}

export class HubClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = CONFIG.HUB_API_URL, apiKey = CONFIG.BOT_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-bot-token': this.apiKey
    };

    const res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err: any = new Error(data.error || `Hub API Error HTTP ${res.status}`);
      err.status = res.status;
      err.gateStatus = data.gateStatus;
      throw err;
    }

    return data as T;
  }

  // Account Linking
  async initiateLink(discordUserId: string, discordUsername: string) {
    return this.request<{ code: string; expiresAt: string; hubUrl: string; instructions: string }>(
      '/link/initiate',
      {
        method: 'POST',
        body: { discordUserId, discordUsername }
      }
    );
  }

  async getUser(discordUserId: string) {
    return this.request<{ linked: boolean; user?: any; message?: string }>(`/user/${discordUserId}`);
  }

  async unlink(discordUserId: string) {
    return this.request<{ success: boolean; message: string }>('/unlink', {
      method: 'POST',
      body: { discordUserId }
    });
  }

  // Tasks
  async getMyTasks(discordUserId: string) {
    return this.request<{ user: any; total: number; grouped: Record<string, any[]>; tasks: any[] }>(
      '/tasks/my-tasks',
      { query: { discordUserId } }
    );
  }

  async getTeamTasks(discordUserId: string, filters: { status?: string; priority?: string; category?: string; teamId?: string; search?: string } = {}) {
    return this.request<{ total: number; tasks: any[] }>('/tasks/team-tasks', {
      query: { discordUserId, ...filters }
    });
  }

  async getTask(taskId: string) {
    return this.request<{ task: any; gates: any; dashboardUrl: string }>(`/tasks/${taskId}`);
  }

  async createTask(data: {
    discordUserId: string;
    title: string;
    description: string;
    priority?: string;
    category?: string;
    teamId?: string;
    deadline?: string;
    ownerUsernameOrId?: string;
    reviewerUsernameOrId?: string;
  }) {
    return this.request<{ success: boolean; task: any; dashboardUrl: string }>('/tasks', {
      method: 'POST',
      body: data
    });
  }

  async assignTask(taskId: string, discordUserId: string, targetUsernameOrId: string) {
    return this.request<{ success: boolean; task: any; dashboardUrl: string }>(`/tasks/${taskId}/assign`, {
      method: 'PATCH',
      body: { discordUserId, targetUsernameOrId }
    });
  }

  async updateTaskStatus(taskId: string, discordUserId: string, newStatus: string) {
    return this.request<{ success: boolean; task: any; dashboardUrl: string }>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: { discordUserId, newStatus }
    });
  }

  async updateTaskDeadline(taskId: string, discordUserId: string, deadline: string) {
    return this.request<{ success: boolean; previousDeadline: string; newDeadline: string; task: any; dashboardUrl: string }>(
      `/tasks/${taskId}/deadline`,
      {
        method: 'PATCH',
        body: { discordUserId, deadline }
      }
    );
  }

  async addComment(taskId: string, discordUserId: string, content: string) {
    return this.request<{ success: boolean; comment: any; dashboardUrl: string }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { discordUserId, content }
    });
  }

  async submitReview(taskId: string, discordUserId: string, reviewerUsernameOrId?: string) {
    return this.request<{ success: boolean; review: any; dashboardUrl: string }>(`/tasks/${taskId}/reviews`, {
      method: 'POST',
      body: { discordUserId, reviewerUsernameOrId }
    });
  }

  // Deadlines & Standup
  async getDeadlines(discordUserId: string, window = '7days') {
    return this.request<{ window: string; total: number; tasks: any[] }>('/deadlines', {
      query: { discordUserId, window }
    });
  }

  async getStandup(discordUserId: string) {
    return this.request<{
      studio: string;
      project: string;
      generatedAt: string;
      completed: any[];
      inProgress: any[];
      blocked: any[];
      upcomingDeadlines: any[];
      pendingReviews: any[];
    }>('/standup', { query: { discordUserId } });
  }

  async getTeam(discordUserId: string) {
    return this.request<{ members: any[] }>('/team', { query: { discordUserId } });
  }

  async getHealth() {
    return this.request<{
      status: string;
      service: string;
      uptimeSeconds: number;
      timestamp: string;
      database: string;
      outbox: any;
      reminders: any;
      guildConfig: any;
    }>('/health');
  }

  // Outbox & Reminders Polling
  async pollOutbox() {
    return this.request<{ events: any[] }>('/outbox/pending');
  }

  async ackOutbox(id: string, success: boolean, error?: string | null) {
    return this.request<{ acknowledged: boolean }>(`/outbox/${id}/ack`, {
      method: 'POST',
      body: { success, error }
    });
  }

  async pollDueReminders() {
    return this.request<{ reminders: any[] }>('/reminders/due');
  }

  async ackReminder(id: string, success: boolean, error?: string | null) {
    return this.request<{ acknowledged: boolean }>(`/reminders/${id}/ack`, {
      method: 'POST',
      body: { success, error }
    });
  }
}

export const hubClient = new HubClient();
