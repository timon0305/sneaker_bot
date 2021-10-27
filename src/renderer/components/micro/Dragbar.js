/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import Clock from './Clock';

const { ipcRenderer } = electron;

/**
 * Draggable top bar for window
 */
export default () => (
  <div className="dragbar">
    <div />
    <Clock />
    <div className="window-buttons" id="window-buttons">
      <div onClick={() => ipcRenderer.send('minimize')} className="window-button yellow">
        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
          <rect fill="#975500" width="8" height="2" x="2" y="5" fillRule="evenodd" />
        </svg>
      </div>
      <div onClick={() => ipcRenderer.send('maxamize')} className="window-button green">
        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
          <g fill="#006500" fillRule="evenodd">
            <path d="M5,3 C5,3 5,6.1325704 5,6.48601043 C5,6.83945045 5.18485201,7 5.49021559,7 L9,7 L9,6 L8,6 L8,5 L7,5 L7,4 L6,4 L6,3 L5,3 Z" transform="rotate(180 7 5)" />
            <path d="M3,5 C3,5 3,8.1325704 3,8.48601043 C3,8.83945045 3.18485201,9 3.49021559,9 L7,9 L7,8 L6,8 L6,7 L5,7 L5,6 L4,6 L4,5 L3,5 Z" />
          </g>
        </svg>
      </div>
      <div onClick={() => ipcRenderer.send('quit')} className="window-button red">
        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
          <path stroke="#4c0000" fill="none" d="M8.5,3.5 L6,6 L3.5,3.5 L6,6 L3.5,8.5 L6,6 L8.5,8.5 L6,6 L8.5,3.5 Z" />
        </svg>
      </div>
    </div>
  </div>
);
