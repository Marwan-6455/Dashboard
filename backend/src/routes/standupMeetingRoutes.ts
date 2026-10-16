import { Router, Response } from 'express';
import { StandupMeetingService } from '../services/standupMeetingService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const standupMeetingRouter = Router();

// Standups
standupMeetingRouter.get('/standups', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { teamId, date } = req.query;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const standups = StandupMeetingService.getStandups({
      workspaceId,
      teamId: teamId as string,
      date: date as string
    });
    res.json({ standups });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

standupMeetingRouter.post('/standups', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { team_id, completed_yesterday, planned_today, blockers, help_needed, date } = req.body;
    if (!team_id || !completed_yesterday || !planned_today) {
      res.status(400).json({ error: 'Missing required standup fields: team_id, completed_yesterday, planned_today.' });
      return;
    }

    const todayDate = date || new Date().toISOString().slice(0, 10);
    const id = `std_${req.user!.id}_${todayDate}`;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    const standup = StandupMeetingService.submitStandup({
      id,
      workspace_id: workspaceId,
      team_id,
      user_id: req.user!.id,
      completed_yesterday,
      planned_today,
      blockers: blockers || null,
      help_needed: help_needed || null,
      date: todayDate
    });

    res.status(201).json({ standup, message: 'Standup logged successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Meetings
standupMeetingRouter.get('/meetings', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, teamId } = req.query;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const meetings = StandupMeetingService.getMeetings({
      workspaceId,
      projectId: projectId as string,
      teamId: teamId as string
    });
    res.json({ meetings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

standupMeetingRouter.post('/meetings', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, team_id, title, date, participants_json, agenda, notes, action_items_json, decisions } = req.body;
    if (!title || !date || !agenda || !notes) {
      res.status(400).json({ error: 'Missing required meeting fields: title, date, agenda, notes.' });
      return;
    }

    const id = `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    const meeting = StandupMeetingService.createMeeting({
      id,
      workspace_id: workspaceId,
      project_id: project_id || null,
      team_id: team_id || null,
      title,
      date,
      participants_json: participants_json || JSON.stringify([req.user!.display_name]),
      agenda,
      notes,
      action_items_json: action_items_json || null,
      decisions: decisions || null,
      created_by: req.user!.id
    });

    res.status(201).json({ meeting });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retrospectives
standupMeetingRouter.get('/retrospectives', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, teamId } = req.query;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const retrospectives = StandupMeetingService.getRetrospectives({
      workspaceId,
      projectId: projectId as string,
      teamId: teamId as string
    });
    res.json({ retrospectives });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

standupMeetingRouter.post('/retrospectives', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, team_id, title, period, what_went_well, what_caused_problems, what_should_change, action_items_json } = req.body;
    if (!title || !period || !what_went_well || !what_caused_problems || !what_should_change) {
      res.status(400).json({ error: 'Missing required retrospective fields.' });
      return;
    }

    const id = `retro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    const retrospective = StandupMeetingService.createRetrospective({
      id,
      workspace_id: workspaceId,
      project_id: project_id || null,
      team_id: team_id || null,
      title,
      period,
      what_went_well,
      what_caused_problems,
      what_should_change,
      action_items_json: action_items_json || null,
      facilitator_id: req.user!.id
    });

    res.status(201).json({ retrospective });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
