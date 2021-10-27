const adyen = require('node-adyen-encrypt')(24);

function EncryptCard(key, card) {
  const cseInstance = adyen.createEncryption(key, {});
  return {
    encryptedCardNumber: cseInstance.encrypt({ number: card.number, generationtime: new Date().toISOString() }),
    encryptedExpiryMonth: cseInstance.encrypt({ expiryMonth: card.month, generationtime: new Date().toISOString() }),
    encryptedExpiryYear: cseInstance.encrypt({ expiryYear: card.year, generationtime: new Date().toISOString() }),
    encryptedSecurityCode: cseInstance.encrypt({ cvc: card.ccv, generationtime: new Date().toISOString() }),
  };
}

module.exports.default = EncryptCard;
