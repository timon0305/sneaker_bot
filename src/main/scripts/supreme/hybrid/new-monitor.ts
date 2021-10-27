import got, { Response } from 'got';
import { ipcMain } from 'electron';
import { SupremeProduct, StockApiResponse, StylesApiResponse, StylesMethodResponse, StyleSize } from './types';
import LogManager from '../../../managers/logs-manager';
import { ITaskData } from '../../../interfaces/index';
import taskColors from '../../../helpers/task-colors';
import { object } from 'prop-types';

export default class SupremeMonitor {
  taskData: ITaskData;
  mobileHeaders: {
    'accept-language': string;
    'x-requested-with': string;
    'user-agent': string;
    referer: string;
    'accept-encoding': string;
  };
  product: SupremeProduct;
  constructor(taskData: ITaskData, proxies: any) {
    this.taskData = taskData;
    this.mobileHeaders = {
      'accept-language': 'en-us',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      referer: 'https://www.supremenewyork.com/mobile',
      'accept-encoding': 'gzip, deflate, br',
    };
    this.product = {
      image: null,
      name: null,
      id: null,
      price: null,
      colorName: null,
      colorId: null,
      url: null,
      sizeId: null,
      sizeName: null,
      productOOS: false,
    };
  }
  sendStatus(status: string, color: string): void {
    ipcMain.emit('hybrid-task-status', { taskID: this.taskData.id, status, color });
  }
  // eslint-disable-next-line class-methods-use-this
  validateKeywords(title: string, keywords: string[]): boolean {
    let positiveKeywords = 0;
    let keywordsFound = 0;
    for (let i = 0; i < keywords.length; i += 1) {
      const keyword = keywords[i];
      if (keyword.charAt(0) === '+') {
        positiveKeywords += 1;
        if (title.toLowerCase().includes(keyword.substr(1).toLowerCase())) {
          keywordsFound += 1;
        }
      } else if (title.toLowerCase().includes(keyword.substr(1).toLowerCase())) {
        return false;
      }
    }
    if (keywordsFound === positiveKeywords) {
      return true;
    }
  }
  /**
   * Monitors a product in the mobile api
   */
  async monitorMobile(): Promise<any> {
    try {
      this.sendStatus('Monitoring', taskColors.yellow);
      LogManager.logMessage('Monitoring', this.taskData.id);
      const { body }: Response<StockApiResponse> = await got('https://www.supremenewyork.com/mobile_stock.json', {
        headers: this.mobileHeaders,
        json: true,
      });
      const categoryData = body.products_and_categories[this.taskData.category];
      const foundProduct = categoryData.find((product) => this.validateKeywords(product.name, this.taskData.monitorInput as string[]));
      // console.log(mobileResponse.headers['cache-control']);
      if (typeof foundProduct === 'undefined') {
        await this.pause(this.taskData.monitorDelay);
        await this.monitorMobile();
        return;
      }
      this.product.name = foundProduct.name;
      this.product.price = foundProduct.price;
      this.product.url = `https://www.supremenewyork.com/shop/${foundProduct.id}`;
      this.product.id = foundProduct.id;
      const foundProductStyle = await this.getProductStyle();
      if (typeof foundProductStyle === 'undefined') {
        this.sendStatus('Invalid color', taskColors.red);
        return;
      }
      const foundProductSize = this.getProductSize(foundProductStyle.sizes);
      if (foundProductSize.stock_level < 1) {
        this.product.productOOS = true;
      }
      this.product.sizeName = foundProductSize.name;
      this.product.sizeId = foundProductSize.id;
    } catch (error) {
      this.sendStatus('Monitor error', taskColors.red);
      LogManager.logMessage(`Monitor error: ${error}`, this.taskData.id, 'fatal');
      await this.getProductStyle();
    }
  }
  /**
   * Gets product styles
   */
  async getProductStyle(): Promise<StylesMethodResponse> {
    try {
      const { body }: Response<StylesApiResponse> = (await got(`${this.product.url}.json`, {
        headers: this.mobileHeaders,
        json: true,
      })) as any;
      if (this.taskData.productColor === 'any') {
        const randomColor = body.styles[Math.floor(Math.random() * body.styles.length)];
        this.product.image = `https:${randomColor.image_url_hi}`;
        this.product.colorName = randomColor.name;
        this.product.colorId = randomColor.id;
        return { name: randomColor.name, colorId: randomColor.id, sizes: randomColor.sizes };
      }
      const foundColor = body.styles.find((style) => style.name.toLowerCase().includes(this.taskData.productColor.toLowerCase()));
      if (typeof foundColor === 'undefined') {
        return undefined;
      }
      this.product.image = `https:${foundColor.image_url_hi}`;
      this.product.colorName = foundColor.name;
      this.product.colorId = foundColor.id;
      return { name: foundColor.name, colorId: foundColor.id, sizes: foundColor.sizes };
    } catch (error) {
      this.sendStatus('Monitor error getting style', taskColors.red);
      LogManager.logMessage(`Monitor error getting style: ${error}`, this.taskData.id, 'fatal');
      await this.getProductStyle();
    }
  }
  /**
   * Gets product size
   */
  getProductSize(sizes: Array<StyleSize>): StyleSize {
    if (this.taskData.sizes.includes('random')) {
      const randomWantedSize = sizes[Math.floor(Math.random() * sizes.length)];
      return randomWantedSize;
    }
    const randomWantedSize = this.taskData.sizes[Math.floor(Math.random() * this.taskData.sizes.length)];
    const foundSize = sizes.find((size) => size.name.toLocaleLowerCase().includes(randomWantedSize.toLocaleLowerCase()));
    return foundSize;
  }
  // eslint-disable-next-line class-methods-use-this
  pause(time: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, time);
    });
  }
  /**
   * Monitors a certain product until it is back in stcok
   */
  async monitorOneProduct(): Promise<void> {
    try {
      this.sendStatus('Waiting for restock', taskColors.yellow);
      LogManager.logMessage(`Waiting for restock`, this.taskData.id);
      const { body }: Response<StylesApiResponse> = await got(`${this.product.url}.json`, {
        headers: this.mobileHeaders,
        json: true,
      });
      const product = Object.values(body.styles).find((product) => product.id === this.product.colorId);
      let availableSizes = product.sizes.filter((size) => size.stock_level >= 1);
      if (availableSizes.length === 0) {
        await this.pause(this.taskData.monitorDelay);
        await this.monitorOneProduct();
      } else {
        const randomInStockSize = availableSizes[Math.floor(Math.random() * availableSizes.length)];
        this.product.productOOS = false;
        this.product.sizeId = randomInStockSize.id;
        this.product.sizeName = randomInStockSize.name;
        return;
      }
    } catch (error) {
      this.sendStatus('Monitor error', taskColors.red);
      LogManager.logMessage(`Monitor error waiting for restock: ${error}`, this.taskData.id, 'fatal');
      await this.monitorOneProduct();
    }
  }
}
