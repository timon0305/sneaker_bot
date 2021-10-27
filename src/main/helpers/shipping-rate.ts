import rp from 'request-promise-native';
import logger from './logger';

class ShippinRate {
  profile: any;
  data: any;
  cookieJar: any;
  userAgent: string;
  inStockVariant: any;
  shippingRate: string;
  constructor(shippingRateData, profile) {
    this.profile = profile;
    this.data = shippingRateData;
    this.cookieJar = rp.jar();
    // eslint-disable-next-line max-len
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36';
  }
  async getProductData(): Promise<void> {
    try {
      const response = await rp.get(`${this.data.shippingURL}.js`, {
        headers: {
          Accept: 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.9',
          'User-Agent': this.userAgent,
        },
        jar: this.cookieJar,
        resolveWithFullResponse: true,
        json: true,
      });
      this.inStockVariant = response.body.variants.find((v) => v.available === true).id;
    } catch (error) {
      logger.fatal(`Error getting shipping rate product: ${error}`);
    }
  }
  async addToCart(): Promise<void> {
    try {
      const siteUrl = new URL(this.data.shippingURL);
      const payload = {
        id: this.inStockVariant,
        quantity: 1,
      };
      await rp.post(`${siteUrl.origin}/cart/add.js`, {
        headers: {
          Origin: siteUrl.origin,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Upgrade-Insecure-Requests': 1,
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          Connection: 'keep-alive',
          Referer: this.data.shippingURL,
          'User-Agent': this.userAgent,
        },
        jar: this.cookieJar,
        resolveWithFullResponse: true,
        form: payload,
        gzip: true,
      });
    } catch (error) {
      logger.fatal(`Error atc shipping rate product: ${error}`);
    }
  }
  async getShippingRates(): Promise<void> {
    try {
      const siteUrl = new URL(this.data.shippingURL);
      const rateData = {
        'shipping_address[zip]': this.profile.shipping.zip,
        'shipping_address[country]': this.profile.shipping.country,
        'shipping_address[province]': this.profile.shipping.state,
      };
      const encodedData = Object.keys(rateData)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(rateData[k])}`)
        .join('&')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/%20/g, '+')
        .replace(/%2520/g, '+');

      const response = await rp.get(`${siteUrl.origin}/cart/shipping_rates.json?${encodedData}`, {
        headers: {
          Origin: siteUrl.origin,
          'Upgrade-Insecure-Requests': 1,
          Host: siteUrl.host,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          Connection: 'keep-alive',
          Referer: `${siteUrl.origin}/cart`,
          'X-Request-With': 'XMLHttpRequest',
          'User-Agent': this.userAgent,
        },
        jar: this.cookieJar,
        resolveWithFullResponse: true,
        gzip: true,
        json: true,
      });
      const rates = response.body.shipping_rates[0];
      this.shippingRate = `${rates.source}-${encodeURI(rates.code)}-${rates.price}`;
      logger.info(`New custom rate: ${this.shippingRate}`);
    } catch (error) {
      logger.fatal(`Error getting shipping rates: ${error}`);
    }
  }
  // eslint-disable-next-line consistent-return
  async getRate(): Promise<string> {
    try {
      await this.getProductData();
      await this.addToCart();
      await this.getShippingRates();
      return this.shippingRate;
    } catch (error) {
      logger.fatal(`Error getting shipping rate: ${error}`);
    }
  }
}

export default ShippinRate;
