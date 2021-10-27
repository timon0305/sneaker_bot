import AutoSolve from 'autosolve-client';
import settingsManager from '../managers/settings-manager';
import taskManager from '../managers/task-manager';
import logger from '../helpers/logger';
import { ICaptchaRequest } from '../interfaces/index';

class AYCDAutoSolve {
  autoSolve: any;
  clientKey: string;
  userKeys: { accesToken: string; apiKey: string };
  constructor() {
    this.clientKey = '';
  }
  // eslint-disable-next-line class-methods-use-this
  isActive(): boolean {
    return settingsManager.autoSolveActive();
  }
  setUserKeys(): void {
    this.userKeys = settingsManager.getAutoSolveKeys();
  }
  setAutoSolve(): void {
    if (!this.isActive()) return;
    this.setUserKeys();
    this.autoSolve = AutoSolve.getInstance({
      accessToken: this.userKeys.accesToken,
      apiKey: this.userKeys.apiKey,
      clientKey: this.clientKey,
      shouldAlertOnCancel: true,
      debug: true,
    });
  }
  // eslint-disable-next-line class-methods-use-this
  receiveToken(messageData): void {
    if (!this.isActive()) return;
    logger.info('Received autosolve token');
    const response = JSON.parse(messageData);
    const captchaResponseData = {
      taskID: response.taskId,
      token: response.token,
      process: taskManager.tasks[response.taskId].pid,
    };
    taskManager.sendCaptcha(captchaResponseData.process, captchaResponseData.taskID, captchaResponseData.token);
  }
  sendTokenRequest(captchaData: ICaptchaRequest): void {
    if (!this.isActive()) return;
    console.log(captchaData);
    logger.info('Getting autosolve token');
    // Version 1 = Invisible captcha
    const version = captchaData.site.includes('supreme') ? '1' : '0';
    const message = {
      taskId: captchaData.taskID.toString(),
      url: captchaData.site.replace(/http:\/\//, 'https://'),
      siteKey: captchaData.sitekey,
      version,
    };
    console.log(message);
    // this.autoSolve.sendTokenRequest(message);
  }
  cancelTokenRequest(taskID): void {
    if (!this.isActive()) return;
    logger.info(`Cancelling autosolve token for task: ${taskID}`);
    this.autoSolve.cancelTokenRequest(taskID);
  }
  cancelAllTokenRequests(): void {
    if (!this.isActive()) return;
    logger.info('Cancelling all autosolve requests');
    this.autoSolve.cancelAllRequests();
  }
  async initAutoSolve(): Promise<void> {
    if (!this.isActive()) return;
    try {
      await this.autoSolve.init();
      logger.info('Connected to autosolve');
      this.autoSolve.ee.on('AutoSolveResponse', this.receiveToken);
      this.autoSolve.ee.on('AutoSolveError', (error) => logger.fatal(`Autosolve error: ${error}`));
    } catch (error) {
      logger.fatal(`Error initializing autosolve: ${error}`);
    }
  }
}
export default new AYCDAutoSolve();
