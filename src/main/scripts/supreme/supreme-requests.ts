import { v4 } from 'uuid';

import MainRequest from '../main-classes/main-request';

import { ITaskData } from '../../interfaces/index';

class SupremeRequests extends MainRequest {
  taskData: ITaskData;
  mobileAgent: string;
  cardinalTID: string;
  apiRegion: string;
  constructor(taskData: ITaskData, proxyGroup: any) {
    super('Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Mobile/15E148 Safari/604.1', proxyGroup);
    this.taskData = taskData;
    this.mobileAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Mobile/15E148 Safari/604.1';
    this.cardinalTID = `Tid-${v4()}`;
  }
  getMobileStock() {
    return this.get(`https://www.supremenewyork.com/mobile_stock.json?_=${v4()}&=${v4()}`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-us',
        'accept-encoding': 'br, gzip, deflate',
        Pragma: 'no-cache',
        'User-Agent': this.mobileAgent,
      },
      timeout: 5000,
      json: true,
    });
  }
  getDesktopStock() {
    return this.get(`https://www.supremenewyork.com/shop.json?_=${v4()}&=${v4()}`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-us',
        'accept-encoding': 'br, gzip, deflate',
        Pragma: 'no-cache',
        'User-Agent': this.mobileAgent,
      },
      timeout: 5000,
      json: true,
    });
  }

  getTicketWasm(url: string) {
    return this.get(url, {
      headers: {
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        'Accept-Language': 'en-us',
        Origin: 'https://www.supremenewyork.com',
        Referer: 'https://www.supremenewyork.com/mobile/',
      },
      encoding: null,
    });
  }

  getProductData(url) {
    return this.get(url, {
      headers: {
        Accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        'accept-language': 'en-us',
        'accept-encoding': 'br, gzip, deflate',
        Origin: 'https://www.supremenewyork.com',
        'User-Agent': this.mobileAgent,
        Referer: 'https://www.supremenewyork.com/mobile/',
        dnt: '1',
      },
      json: true,
      timeout: 5000,
    });
  }

  getMainPage() {
    return this.get('https://www.supremenewyork.com/mobile/', {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'User-Agent': this.mobileAgent,
        Origin: 'https://www.supremenewyork.com',
        Referer: 'https://www.supremenewyork.com/mobile/',
      },
      timeout: 5000,
    });
  }
  getScript(url) {
    return this.get(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US',
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'User-Agent': this.mobileAgent,
        Origin: 'https://www.supremenewyork.com',
        Referer: 'https://www.supremenewyork.com/mobile/',
      },
      timeout: 5000,
    });
  }
  addToCart(id, payload) {
    return this.post(`https://www.supremenewyork.com/shop/${id}/add.json`, {
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/x-www-form-urlencoded',
        host: 'www.supremenewyork.com',
        origin: 'https://www.supremenewyork.com',
        referer: 'https://www.supremenewyork.com/mobile/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'User-Agent': this.mobileAgent,
        'x-requested-with': 'XMLHttpRequest',
      },
      form: payload,
      timeout: 7000,
    });
  }
  getCheckoutForm() {
    return this.get('https://www.supremenewyork.com/mobile/#checkout', {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'User-Agent': this.mobileAgent,
        Origin: 'https://www.supremenewyork.com',
        Referer: 'https://www.supremenewyork.com/mobile/',
        dnt: '1',
      },
      timeout: 7000,
    });
  }
  submitPayment(payload) {
    return this.post('https://www.supremenewyork.com/checkout.json', {
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/x-www-form-urlencoded',
        host: 'www.supremenewyork.com',
        origin: 'https://www.supremenewyork.com',
        referer: 'https://www.supremenewyork.com/mobile/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'User-Agent': this.mobileAgent,
        'x-requested-with': 'XMLHttpRequest',
      },
      timeout: 7000,
      form: payload,
      json: true,
    });
  }
  submitPaymentCardinal(payload, slug) {
    return this.post(`https://www.supremenewyork.com/checkout/${slug}/cardinal.json`, {
      headers: {
        'User-Agent': this.mobileAgent,
        Host: 'www.supremenewyork.com',
        Origin: 'https://www.supremenewyork.com',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'gzip,deflate',
        'Accept-Language': 'en-US,en;q=0.8',
        Connection: 'Keep-Alive',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      timeout: 7000,
      form: payload,
      json: true,
    });
  }
  paymentResult(slug) {
    return this.get(`https://www.supremenewyork.com/checkout/${slug}/status.json`, {
      headers: {
        accept: '*/*',
        'x-requested-with': 'XMLHttpRequest',
        'accept-language': 'en-us',
        'accept-encoding': 'br, gzip, deflate',
        origin: 'https://www.supremenewyork.com',
        referer: 'https://www.supremenewyork.com/mobile/',
        connection: 'keep-alive',
      },
      timeout: 7000,
      json: true,
    });
  }
  getTotals(countryCode: string, cookieSub: string) {
    return this.get(
      // eslint-disable-next-line max-len
      `https://www.supremenewyork.com/checkout/totals_mobile.js?order%5Bbilling_country%5D=${countryCode}&cookie-sub=${cookieSub}&mobile=true`,
      {
        headers: {
          Authority: 'www.supremenewyork.com',
          Accept: 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'User-Agent': this.mobileAgent,
          Origin: 'https://www.supremenewyork.com',
          'accept-language': 'en',
          'accept-encoding': 'gzip, deflate, br',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
          Referer: 'https://www.supremenewyork.com/mobile/',
        },
        timeout: 7000,
      },
    );
  }
  initCardinal(payload: any) {
    return this.post('https://centinelapi.cardinalcommerce.com/V1/Order/JWT/Init', {
      headers: {
        Host: 'centinelapi.cardinalcommerce.com',
        accept: '*/*',
        'accept-encoding': ' gzip, deflate, br',
        'accept-language': 'en-US',
        'content-type': 'application/json;charset=UTF-8',
        origin: 'https://www.supremenewyork.com',
        referer: 'https://www.supremenewyork.com/mobile',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'User-Agent': this.mobileAgent,
        'x-cardinal-tid': this.cardinalTID,
      },
      body: payload,
      json: true,
      timeout: 7000,
    });
  }
  geoCardinalBrowser(payload) {
    return this.post('https://geo.cardinalcommerce.com/DeviceFingerprintWeb/V2/Browser/SaveBrowserData', {
      headers: {
        dnt: '1',
        referer: 'https://geo.cardinalcommerce.com/',
        'user-agent': this.mobileAgent,
        'accept-encoding': 'br, gzip, deflate',
        'accept-language': 'en-us',
        'x-requested-with': 'XMLHttpRequest',
        accept: '*/*',
        'content-type': 'application/json',
      },
      body: payload,
      timeout: 7000,
    });
  }
  getChallenge(id: string) {
    return this.get(`https://api.acs.touch.tech/v1/transactions/${id}/challenge`, {
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        origin: 'https://acs.touch.tech',
        Referer: 'https://acs.touch.tech/v1/emv3ds/challenge',
        'User-Agent': this.userAgent,
      },
      json: true,
      timeout: 7000,
    });
  }
  get3ds(payload) {
    return this.post('https://acs.touch.tech/v1/emv3ds/challenge', {
      headers: {
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        origin: 'https://www.supremenewyork.com',
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-dest': 'iframe',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'navigate',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en',
      },
      form: payload,
      timeout: 7000,
    });
  }
}

export default SupremeRequests;
