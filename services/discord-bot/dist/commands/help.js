import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explains Cindermarch Operations Bot commands, permissions, and dashboard linking');
export async function execute(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('⚡ Cindermarch Operations Bot // Command Reference')
        .setDescription('The **Cindermarch Operations Bot** bridges Discord and the **Engine Hub** for Terminal 6 development. The Engine Hub is the authoritative system of record.')
        .setColor(CONFIG.COLORS.PRIMARY)
        .addFields({
        name: '🔐 Account Linking & Identity',
        value: '`/link` — Start secure single-use code verification with Engine Hub\n' +
            '`/unlink` — Unlink your Discord account from the Hub profile'
    }, {
        name: '📋 Task Management',
        value: '`/my-tasks` — View your assigned tasks grouped by status & deadline\n' +
            '`/team-tasks` — View team tasks with optional status/priority filters\n' +
            '`/task view <id>` — Inspect task details, completion gates & review state\n' +
            '`/task create <title> <desc>` — Create a new task in the Hub\n' +
            '`/task assign <id> <user>` — Reassign task to a team member\n' +
            '`/task status <id> <status>` — Update status (strictly enforces 6 gates)\n' +
            '`/task deadline <id> <date>` — Set or update deadline (reschedules reminders)\n' +
            '`/task comment <id> <text>` — Add comment to task audit trail\n' +
            '`/task review <id>` — Request peer review (prevents self-review)'
    }, {
        name: '⏰ Deadlines & Team Summaries',
        value: '`/deadlines [window]` — View tasks due today, tomorrow, next 7 days, or overdue\n' +
            '`/standup` — Real database summary: completed, in progress, blocked, deadlines\n' +
            '`/team` — View studio members, roles, and current active task workloads\n' +
            '`/subscribe` — Manage notification preferences and opt-outs\n' +
            '`/health` — Safe operational system and database health'
    }, {
        name: '🛡️ Completion Gates Enforcement',
        value: 'Tasks cannot be marked **Verified Complete** via Discord without meeting all 6 verification gates:\n' +
            '1. Criteria Satisfied • 2. Changeset Linked • 3. Peer Review Approved (No self-approval)\n' +
            '4. Visual/Log Evidence • 5. Passing Test Run • 6. No Unresolved Blockers'
    })
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // ${CONFIG.STUDIO.PROJECT}` })
        .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
}
