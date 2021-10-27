/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import MainRequest from '../../main-classes/main-request';

import { ITaskData } from '../../../interfaces/index';

class ShopifyAdvancedRequests extends MainRequest {
  taskData: ITaskData;
  apiKey: any;
  constructor(taskData, proxies) {
    super('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36', proxies);
    this.taskData = taskData;
  }
  login(payload): Promise<any> {
    return this.post(`${this.taskData.site}/account/login`, {
      headers: {
        Origin: this.taskData.site,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8',
        Referer: `${this.taskData.site}/account/login`,
        'User-Agent': this.userAgent,
      },
      form: payload,
    });
  }
  pollQueue(location: string, apiKey: string): Promise<any> {
    return this.get(location, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'close',
        Referer: `${this.taskData.site}/api/checkouts.json`,
        'User-Agent': this.userAgent,
        'X-Shopify-Checkout-Version': '2016-09-06',
      },
      auth: {
        user: apiKey,
      },
    });
  }
  createCheckout(payload, apiKey: string): Promise<any> {
    return this.post(`${this.taskData.site}/api/checkouts.json`, {
      body: payload,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip,deflate,sdch',
        Connection: 'close',
        'cache-control': 'no-store',
        'Content-Type': 'application/json',
        'X-Shopify-Checkout-Version': '2016-09-06',
        'User-Agent': this.userAgent,
      },
      auth: {
        user: apiKey,
      },
      json: true,
      followRedirect: false,
      followAllRedirects: false,
    });
  }
  addToCartFrontend(formData: any, referer: any): Promise<any> {
    return this.post(`${this.taskData.site}/cart/add.js`, {
      headers: {
        Origin: this.taskData.site,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Upgrade-Insecure-Requests': 1,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
        Referer: referer,
        'User-Agent': this.userAgent,
      },
      form: formData,
    });
  }
  addToCart(token: string, payload: any, apiKey: string): Promise<any> {
    return this.patch(`${this.taskData.site}/api/checkouts/${token}.json`, {
      body: payload,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.9',
        'Accept-Language': 'en-GB, en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Upgrade-Insecure-Requests': 1,
        'Content-Type': 'application/json; charset=utf-8',
        Connection: 'keep-alive',
        'X-Shopify-Checkout-Version': '2016-09-06',
        'User-Agent': this.userAgent,
      },
      auth: {
        user: `${apiKey}:`,
      },
      json: true,
    });
  }
  getPaymentID(payload, referer): Promise<any> {
    return this.post('https://elb.deposit.shopifycs.com/sessions', {
      headers: {
        Connection: 'keep-alive',
        Origin: 'https://checkout.shopifycs.com',
        'Content-Type': 'application/json',
        Accept: '*/*',
        Referer: referer,
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'cors',
        'User-Agent': this.userAgent,
      },
      body: payload,
      json: true,
    });
  }
  getShippinRates(token: string, apiKey: string): Promise<any> {
    return this.get(`${this.taskData.site}/api/checkouts/${token}/shipping_rates.json`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'close',
        'Content-Type': 'application/json',
        'X-Shopify-Checkout-Version': '2016-09-06',
        'User-Agent': this.userAgent,
      },
      auth: {
        user: `${apiKey}:`,
      },
    });
  }
  patchCheckoutFrontEnd(checkoutUrl: string, payload, apiKey: string): Promise<any> {
    const headers = {
      Origin: this.taskData.site,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Upgrade-Insecure-Requests': 1,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
      Referer: checkoutUrl,
      'X-Shopify-Storefront-Access-Token': apiKey,
      'User-Agent': this.userAgent,
    };
    return this.patch(checkoutUrl, {
      headers,
      form: payload,
    });
  }
  getCheckout(token: string, apiKey: string): Promise<any> {
    return this.get(`${this.taskData.site}/wallets/checkouts/${token}/payments.json`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.9',
        'Accept-Language': 'en-GB, en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Upgrade-Insecure-Requests': 1,
        Connection: 'keep-alive',
        'X-Shopify-Checkout-Version': '2016-09-06',
        'User-Agent': this.userAgent,
      },
      auth: {
        user: `${apiKey}:`,
      },
    });
  }
}
export default ShopifyAdvancedRequests;
