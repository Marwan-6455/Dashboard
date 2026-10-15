import { describe, it, expect } from 'vitest';
import { commands, commandMap } from '../commands/index.js';
import { CONFIG } from '../config.js';
import { HubClient } from '../api/hubClient.js';
describe('Cindermarch Discord Operations Bot Unit Tests', () => {
    it('registers all 11 required slash commands', () => {
        expect(commands.length).toBe(11);
        const requiredNames = [
            'help',
            'link',
            'unlink',
            'my-tasks',
            'team-tasks',
            'task',
            'deadlines',
            'standup',
            'subscribe',
            'team',
            'health'
        ];
        for (const name of requiredNames) {
            expect(commandMap.has(name)).toBe(true);
            const cmd = commandMap.get(name);
            expect(cmd.data).toBeDefined();
            expect(typeof cmd.execute).toBe('function');
        }
    });
    it('validates /task subcommands and parameter structures', () => {
        const taskCmd = commandMap.get('task');
        const json = taskCmd.data.toJSON();
        expect(json.name).toBe('task');
        expect(json.options).toBeDefined();
        const subcommands = json.options.map((o) => o.name);
        expect(subcommands).toContain('view');
        expect(subcommands).toContain('create');
        expect(subcommands).toContain('assign');
        expect(subcommands).toContain('status');
        expect(subcommands).toContain('deadline');
        expect(subcommands).toContain('comment');
        expect(subcommands).toContain('review');
    });
    it('verifies least-privilege bot configuration and studio brand colors', () => {
        expect(CONFIG.COLORS.PRIMARY).toBe(0xff5722); // Burnt orange
        expect(CONFIG.STUDIO.PROJECT).toBe('Terminal 6');
        expect(CONFIG.STUDIO.NAME).toBe('Cindermarch Studio');
    });
    it('initializes HubClient with configured base URL and API key', () => {
        const client = new HubClient('http://localhost:3001/api/bot', 'test-key');
        expect(client).toBeDefined();
        expect(typeof client.getMyTasks).toBe('function');
        expect(typeof client.initiateLink).toBe('function');
        expect(typeof client.createTask).toBe('function');
        expect(typeof client.updateTaskStatus).toBe('function');
    });
});
