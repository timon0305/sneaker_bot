import { ipcMain, BrowserWindow, session } from 'electron';
import path from 'path';
import CaptchaHarvester from '../harvester/captcha-harvester';
import mainWindow from '../helpers/main-window';
import taskColors from '../helpers/task-colors';
import { ITaskData, IProfile } from '../interfaces/index';
import SupremeHybrid from '../scripts/supreme/hybrid/supreme-hybrid';

class BrowserManager {
  bots: Array<SupremeHybrid>;
  mainWindow: BrowserWindow;
  constructor() {
    this.bots = [];
  }

  async startTask(taskData: ITaskData, profile: IProfile, proxies: any): Promise<void> {
    this.bots[taskData.id] = new SupremeHybrid(taskData, profile, proxies, this.mainWindow);
    await this.bots[taskData.id].startTask();
  }

  showWindow(taskData: ITaskData): void {
    this.bots[taskData.id].task.mainWindow.show();
  }

  stopTask(taskData: ITaskData, sendStatus = false): void {
    if (!this.bots[taskData.id] || typeof this.bots[taskData.id] === 'undefined') {
      return;
    }
    ipcMain.emit('hybrid-task-status', { taskID: taskData.id, status: 'Stopped', color: taskColors.red });
    this.bots[taskData.id].stopTask();
    delete this.bots[taskData.id];
  }

  deleteTask(taskData: ITaskData): void {
    this.bots[taskData.id].task.taskWindow.destroy();
    delete this.bots[taskData.id];
  }
  // eslint-disable-next-line class-methods-use-this
  createTaskWindow(): void {
    // const supremeSessions = Object.values(CaptchaHarvester.captchaWindows).filter(
    //   harvester => harvester.harvesterType === 'supreme',
    // );
    // const randomSession = supremeSessions[Math.floor(Math.random() * supremeSessions.length)];
    // this.mainWindow = new BrowserWindow({
    //   width: 550,
    //   height: 750,
    //   resizable: true,
    //   webPreferences: {
    //     nodeIntegration: true,
    //     enableRemoteModule: false,
    //     session: session.fromPartition(`persist:captcha-session-${randomSession.harvesterID}`),
    //   },
    //   show: false,
    // });
    // CaptchaHarvester.replaceCaptchaWindow(this.mainWindow, randomSession);
  }
}
// ipcMain.on('hybrid-task-status', (statusData: {taskID: number; status: string; color: string}) => {
//  mainWindow.sendStatus(statusData.taskID, statusData.status, statusData.color);
// });
export default new BrowserManager();
