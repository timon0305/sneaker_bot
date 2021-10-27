import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import captchaManager from '../harvester/captcha-harvester';
import mainWindow from '../helpers/main-window';

interface CaptchaHarvester {
  window?: any;
  harvesterID: string;
  harvesterType: string;
  harvesterName: string;
  proxy?: { username: string; password: string; proxyURL: string };
}
const userDataPath = app.getPath('userData');
const harvestersFile = path.join(userDataPath, 'harvesters.json');
let allHarvesters: CaptchaHarvester[] = [];
function setHarvesters(): void {
  const harvesters = fs.readFileSync(harvestersFile).toString();
  const data = JSON.parse(harvesters);
  allHarvesters = data;
  captchaManager.loadHarvesters(allHarvesters);
}
function getHarvesters(): CaptchaHarvester[] {
  return allHarvesters;
}
function initHarvesters(): void {
  if (!fs.existsSync(harvestersFile)) {
    fs.writeFileSync(harvestersFile, '[]');
    return;
  }
  setHarvesters();
}
function harvesterExists(id: string): boolean {
  const found = allHarvesters.find((harvester) => harvester.harvesterID === id);
  if (typeof found !== 'undefined') {
    return true;
  }
  return false;
}
function addHarvester(harvester: CaptchaHarvester): void {
  if (harvesterExists(harvester.harvesterID)) return;
  allHarvesters.push(harvester);
  fs.writeFileSync(harvestersFile, JSON.stringify(allHarvesters), 'utf8');
}
function updateHarvesterProxy(updatedHarvester: CaptchaHarvester): void {
  for (let i = 0; i < allHarvesters.length; i += 1) {
    const harvester = allHarvesters[i];
    if (harvester.harvesterID === updatedHarvester.harvesterID) {
      harvester.proxy = updatedHarvester.proxy;
    }
  }
  fs.writeFileSync(harvestersFile, JSON.stringify(allHarvesters), 'utf8');
}

function delHarvester(harvester: CaptchaHarvester): void {
  allHarvesters.forEach((aHarvester, i) => {
    if (aHarvester.harvesterName === harvester.harvesterName) {
      allHarvesters.splice(i, 1);
      fs.writeFileSync(harvestersFile, JSON.stringify(allHarvesters), 'utf8');
    }
  });
}

function sendHarvesters(): void {
  mainWindow.sendHarvesters(allHarvesters);
}

export default {
  initHarvesters,
  addHarvester,
  updateHarvester: updateHarvesterProxy,
  getHarvesters,
  delHarvester,
  sendHarvesters,
};
