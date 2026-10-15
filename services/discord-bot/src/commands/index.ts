import * as helpCmd from './help.js';
import * as linkCmd from './link.js';
import * as unlinkCmd from './unlink.js';
import * as myTasksCmd from './myTasks.js';
import * as teamTasksCmd from './teamTasks.js';
import * as taskCmd from './task.js';
import * as deadlinesCmd from './deadlines.js';
import * as standupCmd from './standup.js';
import * as subscribeCmd from './subscribe.js';
import * as teamCmd from './team.js';
import * as healthCmd from './health.js';

export const commands = [
  helpCmd,
  linkCmd,
  unlinkCmd,
  myTasksCmd,
  teamTasksCmd,
  taskCmd,
  deadlinesCmd,
  standupCmd,
  subscribeCmd,
  teamCmd,
  healthCmd
];

export const commandMap = new Map<string, any>();
for (const cmd of commands) {
  commandMap.set(cmd.data.name, cmd);
}
