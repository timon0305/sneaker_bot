import React from 'react';
import toaster from 'toasted-notes';
import { shell } from 'electron';

import closeIcon from '../../assets/actions/close_white.svg';

import '../../styles/Toast.scss';

const options = { position: 'bottom-right', duration: 2000 };

export const toastColors = { green: '#00ce6b', red: '#ea244f', blue: '#5fd2ff' };

export const notifyMessage = (title, message, bgColor) => {
  toaster.notify(
    ({ onClose }) => (
      <div className="toast__message__container" style={{ backgroundColor: bgColor }}>
        <div className="toast__message">
          <span className="toast__title">{title}</span>
          <span className="toast__text">{message}</span>
        </div>
        <div onClick={onClose} className="toast__button">
          <img src={closeIcon} className="toast__close" />
        </div>
      </div>
    ),
    options,
  );
};

export const productMessage = (image, link, title, message, bgColor) => {
  toaster.notify(
    ({ onClose }) => (
      <div className="toast__product__container" style={{ backgroundColor: bgColor }}>
        <div className="toast__image__wrapper">
          <img
            src={image}
            onClick={() => {
              shell.openExternal(link);
            }}
            className="toast__image"
          />
        </div>
        <div className="toast__message">
          <span className="toast__title">{title}</span>
          <span className="toast__text">{message}</span>
        </div>
        <div onClick={onClose} className="toast__button">
          <img src={closeIcon} className="toast__close" />
        </div>
      </div>
    ),
    options,
  );
};
