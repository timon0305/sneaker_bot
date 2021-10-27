/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import MainRequests from '../../main-classes/main-request';

import { ITaskData } from '../../../interfaces/index';

class SnipesRequests extends MainRequests {
  taskData: ITaskData;
  constructor(taskData: ITaskData, proxyGroup: any) {
    super('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36', proxyGroup);
    this.taskData = taskData;
  }
  preparePx(url) {
    return this.post('https://staging-curse.revero.io/v1/generate/px2', {
      headers: {
        'content-type': 'application/json',
        'x-revero-auth': '3537379e-bf58-4433-8cf5-de1037750f0d:b5b3eeba-75fc-4263-b244-fc479bd66243',
      },
      json: true,
      body: {
        url,
        appId: 'PX7nhy00fz',
        tag: 'v5.6.0',
        fTag: 164,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
      },
    });
  }
  preparePx3(payload, url) {
    return this.post('https://staging-curse.revero.io/v1/generate/px3', {
      headers: {
        'content-type': 'application/json',
        'x-revero-auth': '3537379e-bf58-4433-8cf5-de1037750f0d:b5b3eeba-75fc-4263-b244-fc479bd66243',
      },
      json: true,
      body: {
        url,
        appId: 'PX7nhy00fz',
        tag: 'v5.6.0',
        fTag: 164,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
        ...payload,
      },
    });
  }
  sendPxData(payload, originURL) {
    return this.post('https://collector-px7nhy00fz.px-cloud.net/api/v2/collector', {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Connection: 'keep-alive',
        accept: '*/*',
        'accept-language': 'en-US',
        'accept-encoding': 'br,gzip,deflate',
        origin: originURL,
        referer: originURL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
      },
      body: payload,
      json: true,
    });
  }
  getProductData(url, pid, originURL) {
    return this.cloudGet(`${url}?pid=${pid}`, {
      headers: {
        Host: originURL,
        authority: originURL,
        connection: 'keep-alive',
        origin: `https://${originURL}`,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
      },
      json: true,
    });
  }
  getSafeProductData(url, originURL) {
    return this.get(url, {
      headers: {
        Host: originURL,
        authority: originURL,
        connection: 'keep-alive',
        origin: `https://${originURL}`,
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',
        referer: `https://${originURL}/c/men/shoes`,
        'accept-language': 'en-US,en;q=0.9',
      },
      json: true,
    });
  }
  getSizeIDRequest(url, id, size, baseURL, originURL) {
    return this.cloudGet(`${url}?chonse=size&dwvar_${id}_212=${size}&format=ajax`, {
      headers: {
        Host: originURL,
        authority: originURL,
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
        'sec-fetch-user': '?1',
        accept: 'application/json, text/javascript, */*; q=0.01',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        origin: baseURL,
        referer: baseURL,
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'x-requested-with': 'XMLHttpRequest',
      },
      json: true,
    });
  }
  atcRequest(url, payload, originURL, productURL) {
    return this.cloudPost(url, {
      headers: {
        Host: originURL,
        authority: originURL,
        accept: 'application/json, text/javascript, */*; q=0.01',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.92 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${originURL}`,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        referer: productURL,
        'accept-language': 'en-US,en;q=0.9',
      },
      form: payload,
      json: true,
    });
  }
  genCSRFRequest(url, originURL) {
    return this.cloudPost(url, {
      headers: {
        Host: originURL,
        authority: originURL,
        accept: 'application/json, text/javascript, */*; q=0.01',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.92 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${originURL}`,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'accept-language': 'en-US,en;q=0.9',
      },
      form: { '': '' },
      json: true,
    });
  }
  checkoutPostRequest(url, payload, stage, baseURL, originURL) {
    return this.cloudPost(url, {
      headers: {
        Host: originURL,
        authority: originURL,
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${originURL}`,
        referer: `${baseURL}/checkout?stage=${stage}`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      form: payload,
      json: true,
    });
  }
  promoCodeRequest(url, coupon, csrfToken, originURL) {
    return this.cloudGet(`${url}&couponCode=${coupon}&csrf_token=${csrfToken}`, {
      headers: {
        Host: originURL,
        authority: originURL,
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: `https://${originURL}`,
        referer: 'https://www.snipes.es/cart',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      json: true,
    });
  }
  removeFromCart(removeCartURL, pid, uuid, baseURL, originURL) {
    return this.cloudGet(`${removeCartURL}?format=ajax&pid=${pid}&uuid=${uuid}`, {
      headers: {
        Host: originURL,
        authority: originURL,
        accept: 'application/json, text/javascript, */*; q=0.01',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
        'content-type': 'application/json',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        referer: `${baseURL}/cart`,
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
      },
      json: true,
    });
  }
}
export default SnipesRequests;
