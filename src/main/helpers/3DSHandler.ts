import { resolveFiles } from 'electron-updater/out/providers/Provider';
import rp from '../scripts/tls-client/wrapper';

export default class Handler {
  Md: string;
  PaReq: string;
  TermUrl: string;
  Token: string;
  request: any;
  constructor(MD: string, PAREQ: string, TERMURL: string) {
    this.Md = MD;
    this.Token = '';
    this.PaReq = PAREQ;
    this.TermUrl = TERMURL;
  }

  async Handle() {
    return new Promise(async (resolve) => {
      this.Token = await this.getToken();
      if (this.Token == 'error') {
        return resolve('error');
      }
      let status = 'pending';
      while (status == 'pending') {
        status = await this.pollRevolut();
        await this.wait(1000);
      }
      resolve(status);
    });
  }

  async getToken(): Promise<string> {
    return new Promise(async (resolve) => {
      const resp = await rp({
        method: 'POST',
        uri: 'https://verifiedbyvisa.acs.touchtechpayments.com/v1/payerAuthentication',
        form: {
          MD: this.Md,
          PaReq: this.PaReq,
          TermUrl: this.TermUrl,
        },
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
          'Cache-Control': 'max-age=0',
          Connection: 'keep-alive',
          'Content-Type': 'application/x-www-form-urlencoded',
          Host: 'verifiedbyvisa.acs.touchtechpayments.com',
          'Sec-Fetch-Dest': 'iframe',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        },
      });
      try {
        console.log(
          resp.body
            .split('config.transaction')[1]
            .split('token:')[1]
            .split('"')[1],
        );
        resolve(
          resp.body
            .split('config.transaction')[1]
            .split('token:')[1]
            .split('"')[1],
        );
      } catch (ex) {
        resolve('error');
      }
    });
  }

  async pollRevolut(): Promise<string> {
    return new Promise(async (resolve) => {
      const resp = await rp({
        method: 'POST',
        uri: 'https://poll.touchtechpayments.com/poll',
        body: `{"transToken": "${this.Token}"}`,
        headers: {
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
          Host: 'poll.touchtechpayments.com',
          Origin: 'https://verifiedbyvisa.acs.touchtechpayments.com',
          Referer: 'https://verifiedbyvisa.acs.touchtechpayments.com/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        },
      });
      const obj = JSON.parse(resp.body);
      resolve(obj.status);
    });
  }
  async wait(ms: number): Promise<any> {
    return new Promise(async (resolve) => {
      setTimeout(() => {
        resolve(null);
      }, ms);
    });
  }
}
