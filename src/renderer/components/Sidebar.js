/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import * as React from 'react';
import { NavLink as Link } from 'react-router-dom';
import { ipcRenderer } from 'electron';
import Logo from '../assets/logo.png';

import { version as novaVersion } from '../../../package.json';

/**
 * Navbar/Sidebar
 */
export default () => (
  <div className="navbar">
    <div className="nav-logo">
      <img src={Logo} style={{ width: 30, height: 30, marginTop: 30 }} />
    </div>
    <div className="nav-items">
      <Link exact to="/dashboard" className="nav__item">
        <div className="animation__wrapper">
          <div className="analytics-animation" />
        </div>
      </Link>
      <Link exact to="/" className="nav__item">
        <div className="animation__wrapper">
          <div className="task-animation" />
        </div>
      </Link>
      <Link exact to="/profiles" className="nav__item">
        <div className="animation__wrapper">
          <div className="profiles-animation" />
        </div>
      </Link>
      <Link exact to="/proxies" className="nav__item">
        <div className="animation__wrapper">
          <div className="proxies-animation" />
        </div>
      </Link>
      <Link exact to="/tools" className="nav__item">
        <div className="animation__wrapper">
          <div className="tools-animation" />
        </div>
      </Link>
      <Link exact to="/harvesters" className="nav__item">
        <div className="animation__wrapper">
          <div className="harvesters-animation" />
        </div>
      </Link>
      <Link exact to="/settings" className="nav__item">
        <div className="animation__wrapper">
          <div className="settings-animation" />
        </div>
      </Link>
    </div>
    <div className="nav__footer" style={{ fontWeight: 'bold' }}>
      <div
        onClick={() => {
          ipcRenderer.send('deactivate');
        }}
        className="animation__wrapper"
      >
        <div className="deactivate-animation" />
      </div>
      v{novaVersion}
    </div>
  </div>
);
