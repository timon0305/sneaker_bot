import got from 'got';
import { ipcMain } from 'electron';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import logger from './logger';

const randomRange = (min, max) => ~~(Math.random() * (max - min + 1)) + min;

export default class DatadomeSolver {
  cookieJar: any;
  request: any;
  body: string;
  proxy: string;
  domain: string;
  apiKey: string;
  debug: boolean;
  cookie: string;
  usingBotSolver: boolean;
  taskID: number;
  constructor(apiKey: string, DatadomeCookie: string, body: string, proxi: string, Domain: string, Debug: boolean, taskID: number) {
    this.domain = Domain;
    this.debug = Debug;
    this.cookie = DatadomeCookie;
    this.apiKey = apiKey;
    this.proxy = proxi;
    this.request = got.extend({
      headers: {
        Host: this.domain.split('/')[2],
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      agent: this.proxy
        ? {
            http: new HttpProxyAgent({ proxy: this.proxy }),
            https: new HttpsProxyAgent({ proxy: this.proxy }),
          }
        : undefined,
    });
    this.body = body;
    this.taskID = taskID;
    // Set a variable so it's easy to change between 2captcha and bot solvers
    this.usingBotSolver = false;
  }
  async Solve(): Promise<string> {
    return new Promise(async (resolve) => {
      try {
        this.log('Got Datadome config.');
        this.log(this.body);
        const dd = this.parseBody();
        if (dd['error']) {
          return resolve('error');
        }
        const IframeURL = `https://geo.captcha-delivery.com/captcha/?initialCid=${encodeURIComponent(dd['cid'])}&hash=${dd['hsh']}&cid=${this.cookie}&t=${dd['t']}&referer=&s=${dd['s']}`;
        const IframeRes = await this.getIframe(IframeURL);
        this.log('Got Captcha Challenge Iframe');
        let captcha = await this.solveCaptcha(IframeRes);
        this.log('Got Captcha token');
        try {
          if (IframeRes['method'] == 'geetest') {
            captcha = JSON.parse(captcha);
          }
        } catch (ex) {}
        const url = `https://geo.captcha-delivery.com/captcha/check${this.createQuery(this.cookie, dd['cid'], dd['hsh'], IframeRes['ip'], dd['s'], captcha)}`;
        this.log('Executing final request');
        const final = await this.request.get(url, {
          headers: {
            Host: 'geo.captcha-delivery.com',
            Connection: 'keep-alive',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: '*/*',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            Referer: IframeURL,
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'fr-FR,fr;q=0.9',
          },
          cookieJar: undefined,
          http2: true,
          throwHttpErrors: false,
        });
        if (final.statusCode == 200) {
          const res = JSON.parse(final.body);
          this.log('Solved Datadome');
          resolve(res.cookie.split('datadome=')[1].split(';')[0]);
        } else {
          resolve('error');
        }
      } catch (_) {
        console.log(_.message), resolve('error');
      }
    });
  }

  parseBody(): object {
    let dd = null;
    try {
      dd = JSON.parse(this.body);
      dd = dd.url;
      dd = {
        cid: dd.split('Cid=')[1].split('&')[0],
        hsh: dd.split('hash=')[1].split('&')[0],
        t: dd.split('t=')[1].split('&')[0],
        s: dd.split('s=')[1],
      };
    } catch (ex) {
      try {
        dd = JSON.parse(
          this.body
            .split('var dd=')[1]
            .split('</script>')[0]
            .split("'")
            .join('"'),
        );
      } catch (_) {
        dd = { error: true };
      }
    }
    return dd;
  }

  createQuery(cid: string, icid: string, hash: string, ip: string, s: string, captchaResponse: string | object): string {
    let queryString = `?cid=${encodeURIComponent(cid)}`;
    queryString += `&icid=${encodeURIComponent(icid)}`;
    queryString += '&ccid=' + 'null';
    if (typeof captchaResponse === 'string') {
      queryString += `&g-recaptcha-response=${captchaResponse}`;
    } else {
      for (const i in captchaResponse) {
        queryString += `&${i.replace('_', '-response-')}=${encodeURIComponent(captchaResponse[i])}`;
      }
    }
    queryString += `&hash=${hash}`;
    queryString += `&ua=${encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36')}`;
    queryString += `&referer=${encodeURIComponent(this.domain)}`;
    queryString += `&parent_url=${encodeURIComponent(this.domain)}`;
    queryString += `&x-forwarded-for=${ip}`;
    queryString += `&captchaChallenge=${randomRange(100000000, 199999999)}`;
    queryString += `&s=${s}`;
    return queryString;
  }

  async getIframe(url: string): Promise<object> {
    return new Promise(async (resolve) => {
      const resp = await this.request(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          Host: 'geo.captcha-delivery.com',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        },
        https: { rejectUnauthorized: false },
        http2: true,
        throwHttpErrors: false,
      });
      if (resp.body.includes('initGeetest')) {
        const a = resp.body.split('initGeetest')[2];
        resolve({
          method: 'geetest',
          ip: resp.body
            .split('&x-forwarded-for=')[1]
            .split('encodeURIComponent')[1]
            .split("'")[1],
          api_server: a.split('api_server')[1].split("'")[1],
          gt: a.split('gt')[1].split("'")[1],
          challenge: a.split('challenge')[1].split("'")[1],
        });
      } else {
        resolve({
          method: 'recaptcha',
          ip: resp.body
            .split('&x-forwarded-for=')[1]
            .split('encodeURIComponent')[1]
            .split("'")[1],
        });
      }
    });
  }

  async solveCaptcha(payload: any): Promise<string> {
    return new Promise(async (resolve) => {
      let captchaApiUrl: string;
      if (payload.method === 'recaptcha') {
        if (this.usingBotSolver) {
          ipcMain.emit('datadome-captcha', {
            site: 'http://geo.captcha-delivery.com/captcha/',
            sitekey: '6LccSjEUAAAAANCPhaM2c-WiRxCZ5CzsjR_vd8uX',
            datadome: true,
            taskID: this.taskID,
            harvesterType: 'shopifyCheckout',
          });
          ipcMain.once(`datadome-solved-${this.taskID}`, (response: any) => {
            resolve(response.token);
          });
          return;
        }
        captchaApiUrl = `https://2captcha.com/in.php?key=${this.apiKey}&method=userrecaptcha&googlekey=6LccSjEUAAAAANCPhaM2c-WiRxCZ5CzsjR_vd8uX&pageurl=https://geo.captcha-delivery.com/captcha/`;
      } else if (payload.method === 'geetest') {
        this.log('Using geetest');
        captchaApiUrl = `https://2captcha.com/in.php?key=${this.apiKey}&method=geetest&gt=${payload.gt}&challenge=${payload.challenge}&api_server=${payload.api_server}&pageurl=https://geo.captcha-delivery.com/captcha/`;
      } else {
        this.log(`Captcha method not found: ${JSON.stringify(payload)}`);
      }
      async function PollCaptcha(id: string): Promise<void> {
        const resp = await got(`https://2captcha.com/res.php?key=2d067982bd0fbec5e8b0b048d18e27e8&action=get&id=${id}`);
        if (resp.body !== 'CAPCHA_NOT_READY') {
          resolve(resp.body.split('OK|')[1]);
        } else {
          setTimeout(async () => {
            await PollCaptcha(id);
          }, 4000);
        }
      }
      async function getId(): Promise<void> {
        const resp = await got(captchaApiUrl);
        const id = resp.body.split('|')[1];
        await PollCaptcha(id);
      }
      await getId();
    });
  }
  log(text: string): void {
    if (this.debug) {
      logger.info(`[DATADOME SOLVER] : ${text}`);
    } else {
      // logsManager.logMessage(`[DATADOME SOLVER] : ${text}`);
    }
  }
}
