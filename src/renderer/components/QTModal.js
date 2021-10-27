import React from 'react';
import { ipcRenderer, clipboard } from 'electron';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

import closeIcon from '../assets/actions/close.svg';
import createIcon from '../assets/actions/create_green.svg';

import { shopifySites } from '../routes/creationComponents/SelectOptions';

class QTModal extends React.Component {
  state = {
    input: '',
    siteType: '',
    site: '',
    siteName: '',
    qtProfiles: [],
    qtSizes: [],
    qtMonitorDelay: 0,
    qtCheckoutDelay: 0,
    qtProxyList: '',
    qtNumTasks: 5,
    custom: false,
  };

  async componentDidMount() {
    if (this.props.qtOpen) {
      ipcRenderer.send('get-settings');
      ipcRenderer.on('sendSettings', async (e, settings) => {
        console.log(settings);
        this.setState(
          {
            qtProfiles: settings.qtProfiles,
            qtSizes: settings.qtSizes,
            qtMonitorDelay: settings.qtMonitorDelay,
            qtCheckoutDelay: settings.qtCheckoutDelay,
            qtProxyList: settings.qtProxyList,
            qtNumTasks: settings.qtNumTasks,
          },
          () => {
            try {
              const url = new URL(clipboard.readText());
              const shopifySite = shopifySites.filter((site) => site.value === url.origin);
              if (shopifySite.length === 1) {
                this.setState(
                  {
                    input: url.href,
                    siteType: 'shopify-advanced',
                    site: shopifySite[0].value,
                    siteName: shopifySite[0].label,
                  },
                  this.createTasks,
                );
              } else if (url.origin === 'https://www.supremenewyork.com') {
                if (settings.qtSupremeRegion === 'US') {
                  console.log('Hello??');
                  this.setState(
                    {
                      input: [`+${url.href}`],
                      siteType: 'supreme',
                      site: 'https://www.supremenewyork.com',
                      siteName: 'Supreme US',
                    },
                    this.createTasks,
                  );
                } else if (settings.qtSupremeRegion === 'EU') {
                  this.setState(
                    {
                      input: [`+${url.href}`],
                      siteType: 'supreme',
                      site: 'https://www.supremenewyork.com',
                      siteName: 'Supreme EU',
                    },
                    this.createTasks,
                  );
                } else {
                  this.setState(
                    {
                      input: [`+${url.href}`],
                      siteType: 'supreme',
                      site: 'https://www.supremenewyork.com',
                      siteName: 'Supreme JP',
                    },
                    this.createTasks,
                  );
                }
              } else if (url.origin.includes('snipes')) {
                console.log('Handle snipes stuff');
              } else {
                console.log(url.origin);
                this.setState(
                  {
                    input: url.href,
                    siteType: 'shopify-advanced',
                    site: url.origin,
                    siteName: url.origin,
                    custom: true,
                  },
                  this.createTasks,
                );
              }
            } catch {
              console.log(clipboard.readText());
            }
          },
        );
      });
    }
  }

  findSiteAndCreate = () => {
    console.log('HHIIkaskdjasklfjklAJFKLASJJADJASDADalfkfsa');
    ipcRenderer.send('get-settings');
    ipcRenderer.on('sendSettings', async (e, settings) => {
      console.log(settings);
      this.setState(
        {
          qtProfiles: settings.qtProfiles,
          qtSizes: settings.qtSizes,
          qtMonitorDelay: settings.qtMonitorDelay,
          qtCheckoutDelay: settings.qtCheckoutDelay,
          qtProxyList: settings.qtProxyList,
          qtNumTasks: settings.qtNumTasks,
        },
        () => {
          try {
            const url = this.state.input;
            const shopifySite = shopifySites.filter((site) => site.value === url.origin);
            if (shopifySite.length === 1) {
              this.setState(
                {
                  input: url.href,
                  siteType: 'shopify-advanced',
                  site: shopifySite[0].value,
                  siteName: shopifySite[0].label,
                },
                this.createTasks,
              );
            } else if (url.origin === 'https://www.supremenewyork.com') {
              if (settings.qtSupremeRegion === 'US') {
                console.log('Hello??');
                this.setState(
                  {
                    input: [`+${url.href}`],
                    siteType: 'supreme',
                    site: 'https://www.supremenewyork.com',
                    siteName: 'Supreme US',
                  },
                  this.createTasks,
                );
              } else if (settings.qtSupremeRegion === 'EU') {
                this.setState(
                  {
                    input: [`+${url.href}`],
                    siteType: 'supreme',
                    site: 'https://www.supremenewyork.com',
                    siteName: 'Supreme EU',
                  },
                  this.createTasks,
                );
              } else {
                this.setState(
                  {
                    input: [`+${url.href}`],
                    siteType: 'supreme',
                    site: 'https://www.supremenewyork.com',
                    siteName: 'Supreme JP',
                  },
                  this.createTasks,
                );
              }
            } else if (url.origin.includes('snipes')) {
              console.log('Handle snipes stuff');
            } else {
              console.log(url.origin);
              this.setState(
                {
                  input: url.href,
                  siteType: 'shopify-advanced',
                  site: url.origin,
                  siteName: url.origin,
                  custom: true,
                },
                this.createTasks,
              );
            }
          } catch {
            console.log(this.state.input);
          }
        },
      );
    });
  };

  createTasks = () => {
    var currentId = 0;
    if (this.props.currentTasks.length > 0) currentId = this.props.currentTasks[this.props.currentTasks.length - 1].id;

    let newTasks = [];

    for (let i = 0; i < this.state.qtProfiles.length; i += 1) {
      for (let j = 0; j < this.state.qtNumTasks; j += 1) {
        currentId = parseInt(currentId) + 1;
        let task = {
          id: currentId,
          siteType: this.state.siteType,
          siteName: this.state.siteName,
          site: this.state.site,
          profile: this.state.qtProfiles[i],
          monitorType: 'url',
          monitorInput: this.state.input,
          sizes: this.state.qtSizes,
          proxies: this.state.qtProxyList,
          monitorDelay: this.state.qtMonitorDelay,
          checkoutDelay: this.state.qtCheckoutDelay,
          status: 'Idle',
          color: '#90a2cf',
          groupName: 'All',
        };

        if (this.state.siteName.includes('Supreme')) {
          task.productColor = 'any';
          task.category = 'new';
          task.monitorType = 'keywords';
          task.quantity = 1;
          task.use3ds = false;
          task.captchaBypass = true;
          task.restockMode = false;
          task.urlMode = true;
          task.retryDelay = 1500;
        } else {
          task.monitorType = 'url';
          task.mode = 'advanced';
          if (this.state.custom) {
            task.custom = true;
          }
        }
        console.log(task);
        this.props.createTasks([task]);
        ipcRenderer.send('task-created', task);
        ipcRenderer.send('start-task', task);
      }
    }

    this.props.qtClose(false);
  };

  render() {
    return (
      <>
        <div className={`edit__modal__wrapper ${this.props.qtOpen ? 'show' : ''}`}>
          <div className="qt__modal">
            <div className="edit__modal__header">
              <h3>Quicktask</h3>
              <div className="button--round light" onClick={() => this.props.qtClose(false)}>
                <img src={closeIcon} alt="" className="button--round__image" />
              </div>
            </div>
            <div className="qt__inputs">
              <input type="text" className="input" value={this.state.input} onChange={(e) => this.setState({ input: e.target.value })} />
              <div className="qt__button">
                <img src={createIcon} alt="" className="qt__icon" onClick={() => this.findSiteAndCreate()} />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}

/**https://awsmonitors.myshopify.com/products/cartweed as
 * mapStateToProps
 * maps reducer state to react props
 *
 * @param {any} state - reducer state
 *
 */
const mapStateToProps = (state) => {
  return {
    currentTasks: state.tasks.currentTasks,
  };
};

export default connect(mapStateToProps, actions)(QTModal);
