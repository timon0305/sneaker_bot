import { load } from 'cheerio';
import { BrowserData } from './types';

/**
 * Gets auth token for any given page
 * @param body Response body
 */
export const getAuthTokenFromBody = (body: string): string => {
  const $ = load(body);
  return $("input[name='authenticity_token']")[0].attribs.value;
};

export const extractTokenFromCheckoutUrl = (checkoutUrl: string): string => {
  const { pathname } = new URL(checkoutUrl);
  return pathname.substring(pathname.indexOf('/checkouts/') + 11);
};
export const extractCdtFromCheckoutUrl = (checkoutUrl: string): string => {
  const { searchParams } = new URL(checkoutUrl);
  return searchParams.get('_ctd');
};

/**
 * Converts an array to an object
 *
 * @param {any[]} array 0 indices are keys, 1 indicies are values
 * @returns {object}
 * @memberof ShopifySafe
 */
export const arrayToObject = (array: any[]): object => {
  const obj = {};
  for (let i = 0; i < array.length; i += 1) {
    const key = array[i][0];
    const value = array[i][1];
    obj[key] = value;
  }
  return obj;
};

/**
 * Organizes the broswer data in the correct order
 * @param browserData Broswer data (this.browserData)
 */
export const organizeBrowserData = (browserData: BrowserData): object => {
  const organizedBroswerArray = [];
  const data = Object.entries(browserData);

  for (let i = 0; i < data.length; i += 1) {
    const entry = data[i];
    // Captcha response has to always be the first key
    if (entry[0] === 'g-recaptcha-response') {
      organizedBroswerArray[0] = ['g-recaptcha-response', entry[1]];
    } else {
      organizedBroswerArray[i] = [entry[0], entry[1]];
    }
  }
  return arrayToObject(organizedBroswerArray);
};

/**
 * Organizes bot proctection tokens in the correct order
 * @param extraValues Object containing bot protection tokens
 */
export const organizeTokens = (extraValues: object): object => {
  const data = Object.entries(extraValues);
  if (!data.find((t) => t[0].includes('-count'))) {
    return extraValues;
  }

  const fsCountValue = data.find((t) => t[0].includes('-count'));
  const cleanArray = data.filter((t) => !t[0].includes('-count'));
  cleanArray.push(fsCountValue);

  return arrayToObject(cleanArray);
};

export const shopifyUrlEncoded = (obj: object, keys = true): string => {
  const string = Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${keys ? encodeURIComponent(obj[k]) : ''}`)
    .join('&')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/%20/g, '+')
    .replace(/%2520/g, '+');

  return string;
};
// https://kith.com/throttle/queue?_ctd=DZvCwstB1%2BJ%2Fbpan8AjaACwvY2FydD90b2tlbj1lYmRmMjI5NDZhMWEzZDEwZWM0NWI5YWZiYzFlMmY1Y8tB1%2BJ%2Fbpan8MtB1%2BJ%2Fb%2BnbIwAAAAA%3D-iFE4IstdtKrTq3GMqzfMvWsavGY%3D&_ctd_update
