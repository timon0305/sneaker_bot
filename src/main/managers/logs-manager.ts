import * as fs from 'fs';
import * as path from 'path';
import request from 'request';
import { app } from 'electron';
import { version } from '../../../package.json';
import settingsManager from './settings-manager';
// import {Webhook} from 'webhook-discord';
import logger from '../helpers/logger';

class LogManager {
  logString: string[];
  folderPath: string;
  fistLogFile: string;
  lastLogFile: string;
  currentLogFile: string;
  dateString: string;
  WAIT_INTERVAL: number;
  webhook: string;
  MAX_LOGS_SENT: number;
  LOGS_SENT: number;
  constructor() {
    this.WAIT_INTERVAL = 20000;
    this.MAX_LOGS_SENT = 5;
    this.LOGS_SENT = 0;
    this.logString = [];
    this.folderPath = path.join(app.getPath('userData'), '/Logs');

    this.fistLogFile = null;
    this.lastLogFile = null;
    // The file we log on for the day
    this.currentLogFile = null;
    // Special date string so we parse it easily
    this.dateString = `${new Date().getDate()}_${new Date().getMonth() + 1}_${new Date().getFullYear()}.log`;
    this.webhook = 'https://discordapp.com/api/webhooks/743456459215470603/lzxMC3z8bcS5OaBQIuGGWAw6g2UFZKZ8lU9lNbsaao-TzzZAI_ANKzIP5PFcnQ_D3ZOW';
  }
  saveLogs(): void {
    const logString = this.logString.map((log) => `${log}\n`).join('');
    fs.appendFileSync(`${this.folderPath}/${this.currentLogFile}`, logString);
    this.logString = [];
  }
  isSameDate(): boolean {
    const lastFileDate = this.lastLogFile.split('aiobot_log_')[1];
    if (lastFileDate === this.dateString) {
      return true;
    }
    return false;
  }
  initLogs(): void {
    if (!fs.existsSync(this.folderPath)) {
      fs.mkdirSync(this.folderPath);
    }
    const newLogFile = `aiobot_log_${this.dateString}`;
    const logFiles = fs.readdirSync(this.folderPath);
    if (logFiles.length > 0) {
      this.lastLogFile = logFiles[logFiles.length - 1];
      // If the latest log has the same day as the current day we select that file as the log file for the day
      if (this.isSameDate()) {
        this.currentLogFile = this.lastLogFile;
        logger.info('Last file has the same date, dont create a new one');
      } else {
        this.currentLogFile = newLogFile;
        logger.info('Creating a new log file for the day');
        fs.appendFileSync(`${this.folderPath}/${newLogFile}`, '');
      }
    } else {
      this.currentLogFile = newLogFile;
      fs.appendFileSync(`${this.folderPath}/${newLogFile}`, '');
    }
    this.startLogSession();
  }
  logMessage(log: string, taskId?: number, type?: string): void {
    // if (type) {
    //   logger[type](`[task-${taskId}]: ${log}`);
    // } else {
    //   logger.info(`[task-${taskId}]: ${log}`);
    // }
    this.logString.push(`[${new Date().toLocaleString()}] - ${log}`);
  }
  startLogSession(): void {
    setInterval(() => {
      this.saveLogs();
    }, this.WAIT_INTERVAL);
  }
  sendLogs(logID: string): void {
    if (this.LOGS_SENT >= this.MAX_LOGS_SENT) return;
    this.saveLogs();
    try {
      const embed = {
        title: 'New logs file 📝',
        color: 4568787,
        description: `${new Date().toUTCString()}`,
        author: {
          name: 'dqweqwe',
          icon_url: 'https://i.imgur.com/qVgUmBB.png',
        },
        footer: {
          text: `qweqweqwe`,
          icon_url: 'https://i.imgur.com/qVgUmBB.png',
        },
        fields: [
          {
            name: 'User',
            value: `||${settingsManager.getKey()}||`,
            inline: true,
          },
          {
            name: 'Log ID',
            value: `${logID}`,
            inline: true,
          },
        ],
      };
      const opts = {
        url: this.webhook,
        method: 'POST',
        headers: {
          Host: new URL(this.webhook).host,
          'Content-Type': 'multipart/form-data',
        },
        formData: {
          file: {
            value: fs.createReadStream(`${this.folderPath}/${this.currentLogFile}`),
            options: {
              filename: this.currentLogFile,
              contentType: null,
            },
          },
          payload_json: `{"embeds":[${JSON.stringify(embed)}]}`,
        },
      };
      request(opts);
      this.LOGS_SENT += 1;
    } catch (error) {
      console.log(error);
    }
  }
}

export default new LogManager();
