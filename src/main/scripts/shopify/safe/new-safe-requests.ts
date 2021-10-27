/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
import got, { Got, CancelableRequest, Response } from 'got';
import { CookieJar } from 'tough-cookie';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import MainRequests from '../../main-classes/main-request';
import { ITaskData, ProxyGroup } from '../../../interfaces/index';

class ShopifySafeRequests extends MainRequests {
  taskData: ITaskData;
  shopifyRequest: Got;
  host: string;
  cookieJar: CookieJar;

  constructor(taskData: ITaskData, proxyGroup: ProxyGroup) {
    super('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36', proxyGroup);
    Object.assign(this, {
      taskData,
      cookieJar: new CookieJar(),
      shopifyRequest: got.extend({
        cookieJar: this.cookieJar,
        prefixUrl: taskData.site,
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en',
        },
        // http2: true,
        mutableDefaults: true,
        // hooks: {
        //   beforeRequest: [
        //     (option): void => {
        //       if (option.prefixUrl.endsWith('/')) {
        //         // eslint-disable-next-line no-param-reassign
        //         option.prefixUrl = option.prefixUrl.slice(0, -1);
        //       }
        //     },
        //   ],
        // },
      }),
      host: new URL(taskData.site).host,
    });
  }
  getCheckpoint(): CancelableRequest<Response<string>> {
    return this.shopifyRequest('/checkpoint', {
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        Referer: this.taskData.site,
      },
    });
  }
  login(payload: { [key: string]: unknown }): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post('account/login', {
      headers: {
        Origin: this.taskData.site,
        Referer: `${this.taskData.site}/account/login`,
      },
      form: payload,
    });
  }
  solveCheckpoint(payload: string, referer: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post('checkpoint', {
      headers: {
        'cache-control': '0',
        'upgrade-insecure-requests': '1',
        origin: this.taskData.site,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',
        referer,
      },
      body: payload,
    });
  }
  getChromeHeaders(url: string, referer: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest(url, {
      prefixUrl: undefined,
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        referer,
      },
      // followRedirect: false,
    });
  }
  preCart(referer: string, variant: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post(`cart/add.js?id=${variant}&quantity=1`, {
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        referer,
      },
    });
  }
  removePreCart(referer: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post('cart/change.js?line=1&quantity=0', {
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        referer,
      },
    });
  }
  createCheckout(): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post('cart', {
      headers: {
        Host: new URL(this.taskData.site).hostname,
        Connection: 'keep-alive',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        Referer: `${this.taskData.site}/cart`,
      },
      form: { checkout: 'Checkout' },
    });
  }
  proceedToCheckout(payload: object): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post('/cart', {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        Referer: `${this.taskData.site}/cart`,
      },
      followRedirect: false,
      form: payload,
    });
  }
  addToCart(payload: string, referer: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest.post('cart/add.js', {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        referer,
      },
      body: payload,
    });
  }
  getXML(url: string, proxy: string = null, referer: string = null): CancelableRequest<Response<string>> {
    const agent = {
      http: new HttpProxyAgent({
        proxy,
      }),
      https: new HttpsProxyAgent({
        proxy,
      }),
    };
    return this.shopifyRequest(url, {
      prefixUrl: undefined,
      headers: {
        'Upgrade-Insecure-Requests': '1',
        referer,
        'X-Requested-With': 'XMLHttpRequest',
        Origin: this.taskData.site,
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      agent: proxy ? agent : undefined,
    });
  }
  pollQueue(referer: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest('checkout/poll?js_poll=1', {
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        referer,
      },
    });
  }
  getCheckoutAfterQueue(url: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest(url, {
      prefixUrl: undefined,
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        Referer: this.taskData.site,
      },
      followRedirect: true,
    });
  }
  getShippingRate(rateData: string): CancelableRequest<Response<string>> {
    return this.shopifyRequest(`cart/shipping_rates.json?${rateData}`, {
      headers: {
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        Referer: `${this.taskData.site}/cart`,
        'X-Request-With': 'XMLHttpRequest',
      },
    });
  }
  getPaymentSession(payload: string, referer: string): CancelableRequest<Response<unknown>> {
    return this.shopifyRequest.post('https://deposit.us.shopifycs.com/sessions', {
      prefixUrl: undefined,
      body: payload,
      headers: {
        Origin: 'https://deposit.us.shopifycs.com/sessions',
        'Content-Type': 'application/json',
        referer,
        'Sec-Fetch-Mode': 'cors',
      },
      responseType: 'json',
    });
  }
  patchEndpoint(checkoutUrl: string, payload: object, proxy: string = null, followRedirect = true): CancelableRequest<Response<string>> {
    const agent = {
      http: new HttpProxyAgent({
        proxy,
      }),
      https: new HttpsProxyAgent({
        proxy,
      }),
    };

    return this.shopifyRequest.post(checkoutUrl.split('?')[0], {
      prefixUrl: undefined,
      form: payload,
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: this.taskData.site,
        'Upgrade-Insecure-Requests': '1',
        Referer: checkoutUrl,
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
      },
      agent: proxy ? agent : undefined,
      followRedirect,
    });
  }
}
export default ShopifySafeRequests;
