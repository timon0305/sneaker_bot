import { BrowserWindow, session } from 'electron';

function createWindow(jar: any, profile: string, size: string, region: string, paypalUrl: string, taskID): void {
  const verificationWindow = new BrowserWindow({
    width: 400,
    height: 650,
    show: true,
    webPreferences: {
      session: session.fromPartition(`persist:${taskID}`),
    },
    title: `${region} - ${size} - ${profile}`,
  });
  const cookieDomains = Object.keys(jar);
  cookieDomains.forEach((key) => {
    const pathObject = jar[key]['/'];
    const pathKeys = Object.keys(pathObject);
    for (let k = 0; k < pathKeys.length; k += 1) {
      const cookieName = pathKeys[k];
      const cookie = pathObject[cookieName];
      const cookieObject = {
        url: `${(cookie.secure ? 'https://' : 'http://') + cookie.domain}/`,
        name: cookie.key,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
      };
      verificationWindow.webContents.session.cookies.set(cookieObject);
    }
  });
  verificationWindow.setMenu(null);
  verificationWindow.loadURL(paypalUrl);
  verificationWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });
}

export default { createWindow };
