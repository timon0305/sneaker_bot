import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import mainWindow from '../helpers/main-window';

const userDataPath = app.getPath('userData');

// TODO: Add settings types
let allProxyGroups = [];
const proxiesFile = path.join(userDataPath, 'proxies.json');

/**
 * Gets all saved proxy groups and saves them to an array
 */
function getAllProxyGroups(): void {
  const proxiesString = fs.readFileSync(proxiesFile).toString();
  const origialProxies = JSON.parse(proxiesString);
  allProxyGroups = origialProxies;
}

/**
 * Initializes proxies file. If it doesnt exist, it makes one.
 */
function initProxies(): void {
  if (!fs.existsSync(proxiesFile)) {
    fs.writeFileSync(proxiesFile, '[]', 'utf8');
  } else {
    getAllProxyGroups();
  }
}

function updateGroups(newGroups): void {
  allProxyGroups = newGroups;
  fs.writeFileSync(proxiesFile, JSON.stringify(allProxyGroups), 'utf-8');
}

function sendProxies(): void {
  mainWindow.sendProxies(allProxyGroups);
}
function getProxyGroup(proxyGroupName: string): {} {
  let proxyGroup = {};
  for (let i = 0; i < allProxyGroups.length; i += 1) {
    const proxyG = allProxyGroups[i];
    if (proxyG.proxyGroupName === proxyGroupName) {
      proxyGroup = proxyG;
      break;
    }
  }
  return proxyGroup;
}

export default { initProxies, allProxyGroups, updateGroups, sendProxies, getProxyGroup };
