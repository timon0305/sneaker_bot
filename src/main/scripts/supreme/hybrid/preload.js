const { getChromeMock, generatePluginArray } = require('./preload_utils');

window.addEventListener('DOMContentLoaded', async () => {
  window.chrome = getChromeMock();
  Object.defineProperty(navigator, 'plugins', {
    get: () => generatePluginArray(),
  });
});
