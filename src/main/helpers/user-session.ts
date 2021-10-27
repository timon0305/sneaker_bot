import rp from 'request-promise-native';

import settingsManager from '../managers/settings-manager';
import { version } from '../../../package.json';
import { admin_webhook } from '../config/setting.json';

class UserSession {
  activeUser: boolean;
  baseData: { key: string | null; startTime: string; endTime: string | null; sessionTasks: number };
  webhook: string;
  constructor() {
    this.activeUser = false;
    this.webhook = admin_webhook;
    this.baseData = {
      key: null,
      startTime: `${new Date().toUTCString()}`,
      endTime: null,
      sessionTasks: 0,
    };
  }
  /**
   * Starts user session
   */
  activateUser(key: string): void {
    if (this.activeUser) {
      this.addSessionTask();
      return;
    }
    this.activeUser = true;
    this.baseData.key = key;
    this.addSessionTask();
    this.activeSession().then(() => {});
  }
  addSessionTask(): void {
    this.baseData.sessionTasks += 1;
  }
  /**
   * Sends user session start message
   */
  async activeSession(): Promise<void> {
    try {
      const embeds = [
        {
          title: 'New user session',
          color: 3984990,
          description: 'User started a task in session',
          author: {
            name: ' AIO',
            // url: 'https://discordapp.com',
          },
          footer: {},
          fields: [
            {
              name: 'User',
              value: `||${this.baseData.key}||`,
              inline: false,
            },
            {
              name: 'Start time',
              value: `${this.baseData.startTime}`,
              inline: false,
            },
          ],
        },
      ];
      const opts = {
        method: 'POST',
        uri: this.webhook,
        json: {
          embeds,
        },
      };
      await rp(opts);
    } catch (error) {
      console.log(error);
    }
  }
  /**
   * Sends user session end message
   */
  async finishSession(): Promise<void> {
    try {
      if (!this.baseData.key) {
        this.baseData.key = settingsManager.getKey();
      }
      this.baseData.endTime = `${new Date().toUTCString()}`;
      const embeds = [
        {
          title: 'Finished user session',
          color: 15676725,
          // description: 'User finished session',
          author: {},
          footer: {},
          fields: [
            {
              name: 'User',
              value: `||${this.baseData.key}||`,
              inline: false,
            },
            {
              name: 'Start time',
              value: `${this.baseData.startTime}`,
              inline: false,
            },
            {
              name: 'End time',
              value: `${this.baseData.endTime}`,
              inline: false,
            },
            {
              name: 'Session tasks',
              value: `${this.baseData.sessionTasks}`,
              inline: false,
            },
          ],
        },
      ];
      const opts = {
        method: 'POST',
        uri: this.webhook,
        json: {
          avatar_url: 'https://i.imgur.com/pxxznJG.png',
          embeds,
        },
      };
      await rp(opts);
    } catch (error) {
      console.log(error);
    }
  }
}

export default new UserSession();
