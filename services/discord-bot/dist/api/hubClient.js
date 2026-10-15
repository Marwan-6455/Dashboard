import { CONFIG } from '../config.js';
export class HubClient {
    baseUrl;
    apiKey;
    constructor(baseUrl = CONFIG.HUB_API_URL, apiKey = CONFIG.BOT_API_KEY) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
    }
    async request(endpoint, options = {}) {
        const url = new URL(`${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
        if (options.query) {
            for (const [key, val] of Object.entries(options.query)) {
                if (val !== undefined && val !== null) {
                    url.searchParams.append(key, val);
                }
            }
        }
        const headers = {
            'Content-Type': 'application/json',
            'x-bot-token': this.apiKey
        };
        const res = await fetch(url.toString(), {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `Hub API Error HTTP ${res.status}`);
            err.status = res.status;
            err.gateStatus = data.gateStatus;
            throw err;
        }
        return data;
    }
    // Account Linking
    async initiateLink(discordUserId, discordUsername) {
        return this.request('/link/initiate', {
            method: 'POST',
            body: { discordUserId, discordUsername }
        });
    }
    async getUser(discordUserId) {
        return this.request(`/user/${discordUserId}`);
    }
    async unlink(discordUserId) {
        return this.request('/unlink', {
            method: 'POST',
            body: { discordUserId }
        });
    }
    // Tasks
    async getMyTasks(discordUserId) {
        return this.request('/tasks/my-tasks', { query: { discordUserId } });
    }
    async getTeamTasks(discordUserId, filters = {}) {
        return this.request('/tasks/team-tasks', {
            query: { discordUserId, ...filters }
        });
    }
    async getTask(taskId) {
        return this.request(`/tasks/${taskId}`);
    }
    async createTask(data) {
        return this.request('/tasks', {
            method: 'POST',
            body: data
        });
    }
    async assignTask(taskId, discordUserId, targetUsernameOrId) {
        return this.request(`/tasks/${taskId}/assign`, {
            method: 'PATCH',
            body: { discordUserId, targetUsernameOrId }
        });
    }
    async updateTaskStatus(taskId, discordUserId, newStatus) {
        return this.request(`/tasks/${taskId}/status`, {
            method: 'PATCH',
            body: { discordUserId, newStatus }
        });
    }
    async updateTaskDeadline(taskId, discordUserId, deadline) {
        return this.request(`/tasks/${taskId}/deadline`, {
            method: 'PATCH',
            body: { discordUserId, deadline }
        });
    }
    async addComment(taskId, discordUserId, content) {
        return this.request(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: { discordUserId, content }
        });
    }
    async submitReview(taskId, discordUserId, reviewerUsernameOrId) {
        return this.request(`/tasks/${taskId}/reviews`, {
            method: 'POST',
            body: { discordUserId, reviewerUsernameOrId }
        });
    }
    // Deadlines & Standup
    async getDeadlines(discordUserId, window = '7days') {
        return this.request('/deadlines', {
            query: { discordUserId, window }
        });
    }
    async getStandup(discordUserId) {
        return this.request('/standup', { query: { discordUserId } });
    }
    async getTeam(discordUserId) {
        return this.request('/team', { query: { discordUserId } });
    }
    async getHealth() {
        return this.request('/health');
    }
    // Outbox & Reminders Polling
    async pollOutbox() {
        return this.request('/outbox/pending');
    }
    async ackOutbox(id, success, error) {
        return this.request(`/outbox/${id}/ack`, {
            method: 'POST',
            body: { success, error }
        });
    }
    async pollDueReminders() {
        return this.request('/reminders/due');
    }
    async ackReminder(id, success, error) {
        return this.request(`/reminders/${id}/ack`, {
            method: 'POST',
            body: { success, error }
        });
    }
}
export const hubClient = new HubClient();
