const isDev = process.env.NODE_ENV === 'development';
const colors = {
  blue: '\x1b[36m[INFO]\x1b[89m',
  purple: '\x1b[34m[UNEXPECTED]\x1b[89m',
  yellow: '\x1b[33m[WARNING]\x1b[89m',
  red: '\x1b[31m[ERROR]\x1b[99m',
  white: '\x1b[97m\x1b[39m',
  green: '\x1b[32m[SUCCESS]\x1b[99m',
};
let logs = [];
const info = (text): void => {
  if (isDev) {
    console.log(`${colors.blue} [${new Date().toLocaleString()}] - ${colors.white} ${text}`);
  } else {
    logs.push(`[${new Date().toLocaleString()}] - ${text}`);
  }
};

const fatal = (text): void => {
  if (isDev) {
    console.log(`${colors.red} [${new Date().toLocaleString()}] - ${colors.white} ${text}`);
  } else {
    logs.push(`[${new Date().toLocaleString()}] - ${text}`);
  }
};

const warning = (text): void => {
  if (isDev) {
    console.log(`${colors.yellow} [${new Date().toLocaleString()}]-${colors.white} ${text}`);
  } else {
    logs.push(`[${new Date().toLocaleString()}] - ${text}`);
  }
};

const success = (text): void => {
  if (isDev) {
    console.log(`${colors.green} [${new Date().toLocaleString()}]-${colors.white} ${text}`);
  } else {
    logs.push(`[${new Date().toLocaleString()}] - ${text}`);
  }
};
function logString(): string {
  if (isDev) return;
  // eslint-disable-next-line consistent-return
  return logs.map((log) => `${log}\n`).join('');
}
function clearLogs(): void {
  logs = [];
}

export default { warning, info, fatal, success, logString, clearLogs };
