import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import mainWindow from '../helpers/main-window';
import logger from '../helpers/logger';
import profileManager from './profile-manager';
import ShippingRate from '../helpers/shipping-rate';

let allShippingRates = [];
const userDataPath = app.getPath('userData');
const shippingRatesFile = path.join(userDataPath, 'shippingRates.json');

function getShippingRates(): void {
  const allRates = fs.readFileSync(shippingRatesFile).toString();
  const parsedRates = JSON.parse(allRates);
  allShippingRates = parsedRates;
}
function initShippingRates(): void {
  if (!fs.existsSync(shippingRatesFile)) {
    fs.writeFileSync(shippingRatesFile, '[]', 'utf8');
  } else {
    getShippingRates();
  }
}
function saveRate(newRateData, rate = ''): void {
  const rateData = { name: newRateData.shippingRateName, rate: newRateData.customRate ? newRateData.customRate : rate };
  allShippingRates.push(rateData);
  fs.writeFileSync(shippingRatesFile, JSON.stringify(allShippingRates), 'utf8');
  mainWindow.sendShippingRates(allShippingRates);
}
async function getRate(newRateData): Promise<void> {
  const profile = profileManager.getProfile(newRateData.shippingProfile);
  const RateGetter = new ShippingRate(newRateData, profile);
  const shippingRate = await RateGetter.getRate();
  saveRate(newRateData, shippingRate);
}
async function newShippingRate(newRateData): Promise<void> {
  if (newRateData.useCustom) {
    logger.info('Saved custom shipping rate');
    saveRate(newRateData);
  } else {
    logger.info('Getting shipping rate');
    await getRate(newRateData);
  }
}
function editShippingRate(index, newRateData): void {
  allShippingRates[index] = { name: newRateData.shippingRateName, rate: newRateData.customRate };
  fs.writeFileSync(shippingRatesFile, JSON.stringify(allShippingRates), 'utf8');
  mainWindow.sendShippingRates(allShippingRates);
}
function deleteShippingRate(index): void {
  allShippingRates.splice(index, 1);
  fs.writeFileSync(shippingRatesFile, JSON.stringify(allShippingRates), 'utf8');
  mainWindow.sendShippingRates(allShippingRates);
}
function sendRates(): void {
  mainWindow.sendShippingRates(allShippingRates);
}
export default { initShippingRates, allShippingRates, newShippingRate, sendRates, editShippingRate, deleteShippingRate };
