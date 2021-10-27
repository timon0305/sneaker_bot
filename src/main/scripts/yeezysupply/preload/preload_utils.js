const { CHROME_MOCKS } = require('./chrome_mocks');
const { randomInt } = require('../utils');

module.exports.generatePluginArray = function() {
  const pluginData = [
    {
      name: 'Chrome PDF Plugin',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
    },
    {
      name: 'Chrome PDF Viewer',
      filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
      description: '',
    },
    {
      name: 'Native Client',
      filename: 'internal-nacl-plugin',
      description: '',
    },
  ];
  const pluginArray = [];
  pluginData.forEach((p) => {
    function FakePlugin() {
      return p;
    }
    const plugin = new FakePlugin();
    Object.setPrototypeOf(plugin, Plugin.prototype);
    pluginArray.push(plugin);
  });
  Object.setPrototypeOf(pluginArray, PluginArray.prototype);
  return pluginArray;
};

module.exports.sleep = function(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports.doesPageExist = function(url) {
  const http = new XMLHttpRequest();
  http.open('HEAD', url, false);
  http.send();
  return http.status !== 404;
};

function getButtonCoords(button) {
  let boundingBox = button.getBoundingClientRect();
  return {
    x: boundingBox.left + boundingBox.width / 2,
    y: boundingBox.top + boundingBox.height / 2,
  };
}

module.exports.getButtonCoords = getButtonCoords;

module.exports.fillInput = function(input, newVal) {
  if (!newVal) return;
  for (let i = 0; i < newVal.length; i += 1) {
    const lastValue = input.value || '';
    input.value = lastValue + newVal[i];
    const keyDownEvent = new KeyboardEvent('keydown', {
      key: newVal[i],
      bubbles: true,
    });
    const keyPressEvent = new KeyboardEvent('keypress', {
      key: newVal[i],
      bubbles: true,
    });
    const newInputEvent = new Event('input', {
      bubbles: true,
    });
    const keyUpEvent = new KeyboardEvent('keyup', {
      key: newVal[i],
      bubbles: true,
    });
    const tracker = input._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }
    input.dispatchEvent(keyDownEvent);
    input.dispatchEvent(keyPressEvent);
    input.dispatchEvent(newInputEvent);
    input.dispatchEvent(keyUpEvent);
  }
  input.dispatchEvent(
    new Event('blur', {
      bubbles: true,
    }),
  );
};

module.exports.simulateClick = function(element) {
  for (let i = 10; i < randomInt(11, 50); i += 1) {
    element.dispatchEvent(
      new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: i,
        clientY: i,
        screenX: i,
        screenY: i,
      }),
    );
  }
  const coords = getButtonCoords(element);
  ['mousedown', 'click', 'mouseup'].forEach((mouseEventType) =>
    element.dispatchEvent(
      new MouseEvent(mouseEventType, {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1,
        clientX: coords.x,
        clientY: coords.y,
        screenX: coords.x,
        screenY: coords.y,
      }),
    ),
  );
};

module.exports.smoothScrollTo = function(elementY, duration) {
  const startingY = window.pageYOffset;
  const diff = elementY - startingY;
  let start;

  // Bootstrap our animation - it will get called right before next frame shall be rendered.
  window.requestAnimationFrame(function step(timestamp) {
    if (!start) start = timestamp;
    // Elapsed milliseconds since start of scrolling.
    const time = timestamp - start;
    // Get percent of completion in range [0, 1].
    const percent = Math.min(time / duration, 1);

    window.scrollTo(0, startingY + diff * percent);

    // Proceed with animation as long as we wanted it to.
    if (time < duration) {
      window.requestAnimationFrame(step);
    }
  });
};

module.exports.getChromeRuntime = function() {
  return CHROME_MOCKS[randomInt(0, CHROME_MOCKS.length - 1)];
};

module.exports.getRandomWindowDimensions = function() {
  return {
    width: randomInt(800, 1000),
    height: randomInt(800, 1100),
  };
};
