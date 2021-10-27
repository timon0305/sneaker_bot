import got, { Response } from 'got';
import MainRequests from '../../main-classes/main-request';

import { ITaskData } from '../../../interfaces/index';

class ShopifyRequests extends MainRequests {
  taskData: ITaskData;
  constructor(taskData: ITaskData, proxyGroup: any) {
    super('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36', proxyGroup);
    this.taskData = taskData;
  }
  // Gets any page with cache bypass
  getEndpoint(url: string): Promise<Response<string>> {
    return this.get(url, {
      headers: {
        Accept: 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.9',
        'X-Shopify-Api-Features': Math.random() * Number.MAX_SAFE_INTEGER,
      },
      timeout: 10000,
    });
  }
  getChromeHeaders(url: string, referer: string) {
    return this.get(url, {
      headers: {
        Host: new URL(url).hostname,
        Origin: url,
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': 1,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: referer,
        'User-Agent': this.userAgent,
      },
    });
  }
}
export default ShopifyRequests;
