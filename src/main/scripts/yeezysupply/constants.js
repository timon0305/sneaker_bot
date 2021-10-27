module.exports.CHROME_VERSIONS = ['81.0.4044.138', '81.0.4044.129'];

module.exports.NO_PROXY = 'NO PROXY';

module.exports.TASK_STATUSES = Object.freeze({
  WAITING_FOR_DROP: 'Waiting for product to drop',
  WAITING: 'In waiting room',
  PASSED_QUEUE: 'Passed waiting room',
  ENTERING_SHIPPING: 'Entering shipping info',
  SUBMIT_SHIPPING: 'Submitting shipping info',
  ENTERING_PAYMENT: 'Entering payment info',
  SUBMIT_PAYMENT: 'Submitting payment info',
  CHECKED_OUT: 'Checking out',
});
