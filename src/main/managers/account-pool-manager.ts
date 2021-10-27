import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import mainWindow from '../helpers/main-window';
import taskManager from '../managers/task-manager';

let allAccountsPools = [];
const userDataPath = app.getPath('userData');
const accountPoolFile = path.join(userDataPath, 'accounts.json');

function getAccountPools(): void {
  const accPools = fs.readFileSync(accountPoolFile).toString();
  const parsedPools = JSON.parse(accPools);
  allAccountsPools = parsedPools;
}
function initAccountPools(): void {
  if (!fs.existsSync(accountPoolFile)) {
    fs.writeFileSync(accountPoolFile, '[]', 'utf8');
  } else {
    getAccountPools();
  }
}
function updatePools(newPool): void {
  allAccountsPools.push(newPool);
  fs.writeFileSync(accountPoolFile, JSON.stringify(allAccountsPools), 'utf8');
  mainWindow.sendAccountPools(allAccountsPools);
}
function editPool(index, pool): void {
  allAccountsPools[index] = pool;
  fs.writeFileSync(accountPoolFile, JSON.stringify(allAccountsPools), 'utf8');
  mainWindow.sendAccountPools(allAccountsPools);
}
function deletePool(index): void {
  allAccountsPools.splice(index, 1);
  fs.writeFileSync(accountPoolFile, JSON.stringify(allAccountsPools), 'utf8');
  mainWindow.sendAccountPools(allAccountsPools);
}
function sendPools(): void {
  mainWindow.sendAccountPools(allAccountsPools);
}

export default { initAccountPools, allAccountsPools, updatePools, sendPools, editPool, deletePool };
