import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

import mainWindow from '../helpers/main-window';

let allAnalytics = [];
const userDataPath = app.getPath('userData');
const analyticsFile = path.join(userDataPath, 'analytics.json');

function getAnalytics(): void {
  const analytics = fs.readFileSync(analyticsFile).toString();
  const parsedAnalytics = JSON.parse(analytics);
  allAnalytics = parsedAnalytics;
}

function initAnalytics(): void {
  if (!fs.existsSync(analyticsFile)) {
    fs.writeFileSync(analyticsFile, '[]', 'utf8');
  } else {
    getAnalytics();
  }
}

function updateAnalytics(checkout): void {
  allAnalytics.push(checkout);
  fs.writeFileSync(analyticsFile, JSON.stringify(allAnalytics), 'utf8');
  mainWindow.sendAnalytics(allAnalytics);
}

function clearDeclines(): void {
  allAnalytics = allAnalytics.filter((checkout) => checkout.type === 'checkout');
  fs.writeFileSync(analyticsFile, JSON.stringify(allAnalytics), 'utf8');
  mainWindow.sendAnalytics(allAnalytics);
}

function sendAnalytics(): void {
  mainWindow.sendAnalytics(allAnalytics);
}

export default { initAnalytics, sendAnalytics, updateAnalytics, clearDeclines };
