import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export const data = new SlashCommandBuilder()
  .setName('task')
  .setDescription('Manage Terminal 6 development tasks on the Cindermarch Engine Hub')
  // Subcommand: view
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View detailed task status, completion gates, and dashboard links')
      .addStringOption((opt) =>
        opt.setName('task_id').setDescription('Task ID (e.g. T6-ENG-001)').setRequired(true)
      )
  )
  // Subcommand: create
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a real task in the Cindermarch Engine Hub')
      .addStringOption((opt) => opt.setName('title').setDescription('Task title').setRequired(true))
      .addStringOption((opt) => opt.setName('description').setDescription('Task description').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('priority')
          .setDescription('Task priority')
          .setRequired(false)
          .addChoices(
            { name: 'P0 (Blocker / Critical)', value: 'P0' },
            { name: 'P1 (High)', value: 'P1' },
            { name: 'P2 (Normal)', value: 'P2' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('Category')
          .setRequired(false)
          .addChoices(
            { name: 'Gameplay', value: 'Gameplay' },
            { name: 'Engine', value: 'Engine' },
            { name: 'Graphics', value: 'Graphics' },
            { name: 'Audio', value: 'Audio' },
            { name: 'QA', value: 'QA' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('team')
          .setDescription('Assign to one of the 6 studio teams')
          .setRequired(false)
          .addChoices(
            { name: 'Story Team', value: 'team_story' },
            { name: 'Coding Team', value: 'team_coding' },
            { name: 'Marketing Team', value: 'team_marketing' },
            { name: 'Engine Team', value: 'team_engine' },
            { name: '3D Artists', value: 'team_3d_artists' },
            { name: 'Sound Team', value: 'team_sound' }
          )
      )
      .addStringOption((opt) =>
        opt.setName('deadline').setDescription('Deadline date (YYYY-MM-DD)').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('assignee').setDescription('Assignee username or display name').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('reviewer').setDescription('Reviewer username or display name').setRequired(false)
      )
  )
  // Subcommand: assign
  .addSubcommand((sub) =>
    sub
      .setName('assign')
      .setDescription('Assign or reassign a task to a team member')
      .addStringOption((opt) => opt.setName('task_id').setDescription('Task ID (e.g. T6-ENG-001)').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('user').setDescription('Target user (username or display name)').setRequired(true)
      )
  )
  // Subcommand: status
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('Change the status of a task (respects the 6 completion gates)')
      .addStringOption((opt) => opt.setName('task_id').setDescription('Task ID (e.g. T6-ENG-001)').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('New status')
          .setRequired(true)
          .addChoices(
            { name: 'Backlog', value: 'Backlog' },
            { name: 'In Progress', value: 'In Progress' },
            { name: 'Ready for Review', value: 'Ready for Review' },
            { name: 'Changes Requested', value: 'Changes Requested' },
            { name: 'Ready to Integrate', value: 'Ready to Integrate' },
            { name: 'Verified Complete', value: 'Verified Complete' },
            { name: 'Blocked', value: 'Blocked' }
          )
      )
  )
  // Subcommand: deadline
  .addSubcommand((sub) =>
    sub
      .setName('deadline')
      .setDescription('Set or change a task deadline (reschedules reminders)')
      .addStringOption((opt) => opt.setName('task_id').setDescription('Task ID (e.g. T6-ENG-001)').setRequired(true))
      .addStringOption((opt) => opt.setName('date').setDescription('Deadline date (YYYY-MM-DD)').setRequired(true))
  )
  // Subcommand: comment
  .addSubcommand((sub) =>
    sub
      .setName('comment')
      .setDescription('Add a comment to the task activity record')
      .addStringOption((opt) => opt.setName('task_id').setDescription('Task ID (e.g. T6-ENG-001)').setRequired(true))
      .addStringOption((opt) => opt.setName('content').setDescription('Comment text').setRequired(true))
  )
  // Subcommand: review
  .addSubcommand((sub) =>
    sub
      .setName('review')
      .setDescription('Request peer review for a task (strictly prohibits self-approval)')
      .addStringOption((opt) => opt.setName('task_id').setDescription('Task ID (e.g. T6-ENG-001)').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('reviewer').setDescription('Reviewer username or display name (e.g. lead)').setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'view':
      return handleView(interaction);
    case 'create':
      return handleCreate(interaction);
    case 'assign':
      return handleAssign(interaction);
    case 'status':
      return handleStatus(interaction);
    case 'deadline':
      return handleDeadline(interaction);
    case 'comment':
      return handleComment(interaction);
    case 'review':
      return handleReview(interaction);
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

// -----------------------------------------------------------------------------
// Subcommand Handlers
// -----------------------------------------------------------------------------

async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  const taskId = interaction.options.getString('task_id', true).trim().toUpperCase();

  try {
    const res = await hubClient.getTask(taskId);
    const task = res.task;
    const gates = res.gates;

    let statusColor = CONFIG.COLORS.PRIMARY;
    if (task.status === 'Verified Complete') statusColor = CONFIG.COLORS.SUCCESS;
    if (task.status === 'Blocked') statusColor = CONFIG.COLORS.DANGER;
    if (task.status === 'Ready for Review') statusColor = CONFIG.COLORS.WARNING;

    const embed = new EmbedBuilder()
      .setTitle(`[${task.id}] ${task.title}`)
      .setURL(res.dashboardUrl)
      .setDescription(task.description || '*No description provided.*')
      .setColor(statusColor)
      .addFields(
        {
          name: '📊 Status & Priority',
          value: `Status: **${task.status}**\nPriority: \`${task.priority}\` • Category: **${task.category || 'Gameplay'}**`,
          inline: true
        },
        {
          name: '👤 Ownership',
          value: `Assignee: **${task.owner_name ? `@${task.owner_name}` : 'Unassigned'}**\nReviewer: **${task.reviewer_name ? `@${task.reviewer_name}` : 'Unassigned'}**`,
          inline: true
        },
        {
          name: '⏰ Deadline',
          value: task.deadline ? `**${task.deadline}**` : '*None set*',
          inline: true
        }
      );

    // Completion Gates Check
    const gateLines = [
      `${gates.gates.acceptanceCriteria.passed ? '✅' : '❌'} Acceptance Criteria (${gates.gates.acceptanceCriteria.satisfied}/${gates.gates.acceptanceCriteria.total})`,
      `${gates.gates.changesetLinked.passed ? '✅' : '❌'} UVCS Changeset Linked (${gates.gates.changesetLinked.count} linked${gates.gates.changesetLinked.exempt ? ' • Exempt' : ''})`,
      `${gates.gates.peerReview.passed ? '✅' : '❌'} Peer Review (${gates.gates.peerReview.approved ? 'Approved' : 'Pending'})`,
      `${gates.gates.evidence.passed ? '✅' : '❌'} Evidence Artifacts (${gates.gates.evidence.count} files)`,
      `${gates.gates.testReports.passed ? '✅' : '❌'} Automated Test Run (${gates.gates.testReports.reportsCount} passed${gates.gates.testReports.exempt ? ' • Exempt' : ''})`,
      `${gates.gates.dependencies.passed ? '✅' : '❌'} Blockers / Dependencies (${gates.gates.dependencies.blockedBy.length} blockers)`
    ];

    embed.addFields({
      name: `🛡️ Completion Verification Gates (${gates.passed ? 'PASSED ✅' : 'INCOMPLETE ❌'})`,
      value: gateLines.join('\n')
    });

    embed.setFooter({ text: `${CONFIG.STUDIO.NAME} // Open dashboard link to inspect evidence & artifacts` });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Task Not Found')
          .setDescription(err.message || `Could not find task ${taskId}`)
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const title = interaction.options.getString('title', true).trim();
  const description = interaction.options.getString('description', true).trim();
  const priority = interaction.options.getString('priority') || 'P1';
  const category = interaction.options.getString('category') || 'Gameplay';
  const team = interaction.options.getString('team') || undefined;
  const deadline = interaction.options.getString('deadline') || undefined;
  const assignee = interaction.options.getString('assignee') || undefined;
  const reviewer = interaction.options.getString('reviewer') || undefined;

  try {
    const res = await hubClient.createTask({
      discordUserId: interaction.user.id,
      title,
      description,
      priority,
      category,
      teamId: team,
      deadline,
      ownerUsernameOrId: assignee,
      reviewerUsernameOrId: reviewer
    });

    const task = res.task;
    const embed = new EmbedBuilder()
      .setTitle(`✅ Task Created // [${task.id}] ${task.title}`)
      .setURL(res.dashboardUrl)
      .setDescription(task.description)
      .setColor(CONFIG.COLORS.PRIMARY)
      .addFields(
        { name: 'Priority', value: `\`${task.priority}\``, inline: true },
        { name: 'Category', value: task.category, inline: true },
        { name: 'Team', value: task.team_name || team || 'Studio', inline: true },
        { name: 'Status', value: `\`${task.status}\``, inline: true },
        { name: 'Assignee', value: task.owner_name ? `@${task.owner_name}` : '*Unassigned*', inline: true },
        { name: 'Deadline', value: task.deadline ? task.deadline : '*None*', inline: true }
      )
      .setFooter({ text: 'Task created on Cindermarch Engine Hub' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Failed to Create Task')
          .setDescription(err.message || 'Error occurred while saving task to Engine Hub.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}

async function handleAssign(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const taskId = interaction.options.getString('task_id', true).trim().toUpperCase();
  const user = interaction.options.getString('user', true).trim();

  try {
    const res = await hubClient.assignTask(taskId, interaction.user.id, user);
    const task = res.task;

    const embed = new EmbedBuilder()
      .setTitle(`👤 Task Reassigned // [${task.id}]`)
      .setURL(res.dashboardUrl)
      .setDescription(`Task **${task.title}** has been assigned to **@${task.owner_name}**.`)
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Assignment Failed')
          .setDescription(err.message || 'Failed to reassign task.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const taskId = interaction.options.getString('task_id', true).trim().toUpperCase();
  const newStatus = interaction.options.getString('status', true);

  try {
    const res = await hubClient.updateTaskStatus(taskId, interaction.user.id, newStatus);
    const task = res.task;

    let color = CONFIG.COLORS.PRIMARY;
    if (newStatus === 'Verified Complete') color = CONFIG.COLORS.SUCCESS;
    if (newStatus === 'Blocked') color = CONFIG.COLORS.DANGER;

    const embed = new EmbedBuilder()
      .setTitle(`🔄 Status Updated // [${task.id}]`)
      .setURL(res.dashboardUrl)
      .setDescription(`Task **${task.title}** status changed to **${newStatus}**.`)
      .setColor(color)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    // If completion gates failed, format clear actionable checklist
    if (err.gateStatus) {
      const gateEmbed = new EmbedBuilder()
        .setTitle(`🛡️ Completion Gates Blocked // [${taskId}]`)
        .setDescription(
          `**Cannot mark Verified Complete.** The following mandatory studio verification gates have not been satisfied:\n\n` +
          err.gateStatus.reasons.map((r: string, idx: number) => `**${idx + 1}.** ${r}`).join('\n\n') +
          `\n\n🔗 Please complete verification in the [Engine Hub](${CONFIG.HUB_WEB_URL}/tasks/${taskId}).`
        )
        .setColor(CONFIG.COLORS.DANGER)
        .setFooter({ text: 'Cindermarch Studio Quality Policy // No bypassing gates via Discord' });

      await interaction.editReply({ embeds: [gateEmbed] });
      return;
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Status Update Failed')
          .setDescription(err.message || 'Unable to update status.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}

async function handleDeadline(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const taskId = interaction.options.getString('task_id', true).trim().toUpperCase();
  const deadline = interaction.options.getString('date', true).trim();

  try {
    const res = await hubClient.updateTaskDeadline(taskId, interaction.user.id, deadline);

    const embed = new EmbedBuilder()
      .setTitle(`⏰ Deadline Updated // [${taskId}]`)
      .setURL(res.dashboardUrl)
      .setDescription(
        `Task **${res.task.title}** deadline set to **${res.newDeadline}**.\n` +
        `Previous: *${res.previousDeadline || 'None'}*\n\n` +
        `✅ Persistent scheduled reminders (24h, 2h, due) have been recalculated.`
      )
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Deadline Update Failed')
          .setDescription(err.message || 'Failed to update deadline.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}

async function handleComment(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const taskId = interaction.options.getString('task_id', true).trim().toUpperCase();
  const content = interaction.options.getString('content', true).trim();

  try {
    const res = await hubClient.addComment(taskId, interaction.user.id, content);

    const embed = new EmbedBuilder()
      .setTitle(`💬 Comment Added // [${taskId}]`)
      .setURL(res.dashboardUrl)
      .setDescription(`"${res.comment.content}"`)
      .setFooter({ text: `Added by ${res.comment.user_name} • Attributed to Engine Hub audit log` })
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Comment Failed')
          .setDescription(err.message || 'Failed to post comment to task.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}

async function handleReview(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const taskId = interaction.options.getString('task_id', true).trim().toUpperCase();
  const reviewer = interaction.options.getString('reviewer') || undefined;

  try {
    const res = await hubClient.submitReview(taskId, interaction.user.id, reviewer);

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Peer Review Requested // [${taskId}]`)
      .setURL(res.dashboardUrl)
      .setDescription(
        `Task **${taskId}** has been moved to **Ready for Review**.\n` +
        `Reviewer assigned. Notification dispatched to reviewer.\n\n` +
        `⚠️ *Developers cannot approve their own reviews.*`
      )
      .setColor(CONFIG.COLORS.WARNING)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Review Request Failed')
          .setDescription(err.message || 'Unable to submit review request.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}
