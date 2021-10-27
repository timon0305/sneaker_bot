import _ from 'lodash';
import rp from 'request-promise-native';
import cloudscraper from 'cloudscraper';

const ciphers = [
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305-SHA256',
  'ECDHE-RSA-CHACHA20-POLY1305-SHA256',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'RSA-AES128-GCM-SHA256',
  'RSA-AES256-GCM-SHA384',
  'RSA-AES128-SHA',
  'RSA-AES256-SHA',
  'RSA-3DES-EDE-SHA',
].join(':');

class MainRequests {
  proxyGroup: {
    proxies: string[];
  };
  userAgent: string;
  cookieJar: any;
  currentProxy: string;
  constructor(
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36',
    proxyGroup: {
      proxies: string[];
    },
  ) {
    this.proxyGroup = proxyGroup;
    this.userAgent = userAgent;
    this.cookieJar = rp.jar();
    this.saveProxy();
  }
  makeRequest(method: string, url: string, opts: any = {}) {
    const options = {
      ...opts,
      proxy: opts.proxy ? opts.proxy : this.currentProxy,
      headers: {
        ...opts.headers,
        'user-agent': opts.headers['User-Agent'] || this.userAgent,
      },
    };
    return rp({
      uri: url,
      method,
      simple: false,
      gzip: true,
      timeout: 20000,
      jar: this.cookieJar,
      followAllRedirects: true,
      resolveWithFullResponse: true,
      forever: true,
      ciphers,
      strictSSL: false,
      secureProtocol: 'TLSv1_2_method',
      ...options,
    });
  }
  makeCloudRequest(method: string, url: string, opts: any = {}) {
    const options = {
      ...opts,
      proxy: opts.proxy ? opts.proxy : this.currentProxy,
      headers: {
        ...opts.headers,
        'user-agent': opts.headers['User-Agent'] || this.userAgent,
      },
    };
    return cloudscraper({
      uri: url,
      method,
      gzip: true,
      timeout: 20000,
      jar: this.cookieJar,
      followAllRedirects: true,
      resolveWithFullResponse: true,
      forever: true,
      ciphers,
      secureProtocol: 'TLSv1_2_method',
      ...options,
      simple: false,
    });
  }
  get(url: string, options = {}) {
    return this.makeRequest('GET', url, options);
  }
  post(url: string, options = {}) {
    return this.makeRequest('POST', url, options);
  }
  patch(url: string, options = {}) {
    return this.makeRequest('PATCH', url, options);
  }
  cloudGet(url: string, options = {}) {
    return this.makeCloudRequest('GET', url, options);
  }
  cloudPost(url: string, options = {}) {
    return this.makeCloudRequest('POST', url, options);
  }
  cloudPatch(url: string, options = {}) {
    return this.makeCloudRequest('PATCH', url, options);
  }
  saveProxy(): void {
    if (this.proxyGroup === null) {
      this.currentProxy = null;
      return;
    }
    const randomProxy = _.sample(this.proxyGroup.proxies).split(':');
    if (!randomProxy[2] && !randomProxy[3]) {
      this.currentProxy = `http://${randomProxy[0]}:${randomProxy[1]}`;
      return;
    }
    this.currentProxy = `http://${randomProxy[2]}:${randomProxy[3]}@${randomProxy[0]}:${randomProxy[1]}`;
  }
}
export default MainRequests;
