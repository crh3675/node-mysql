var Sequence = require('./Sequence');
var Util     = require('util');
var Packets  = require('../packets');
var Auth     = require('../Auth');

module.exports = SSLConnect;
Util.inherits(SSLConnect, Sequence);
function SSLConnect(config, callback) {
  Sequence.call(this, callback);

  this._config                        = config;
  this._sslConnectPacket = null;
}

SSLConnect.prototype.start = function() {
  this.emit('packet', new Packets.SSLConnectPacket);
};

SSLConnect.prototype.determinePacket = function(firstByte, parser) {
  if (firstByte === 0xff) {
    return Packets.ErrorPacket;
  }

  if (!this._sslConnectPacket) {
    return Packets.SSLConnectPacket;
  }
};

SSLConnect.prototype['SSLConnectPacket'] = function(packet) {
  this._sslConnectPacket = packet;

  this.emit('packet', new Packets.SSLConnectPacket({
    clientFlags   : this._config.clientFlags,
    maxPacketSize : this._config.maxPacketSize,
    charsetNumber : this._config.charsetNumber
  }));
};

SSLConnect.prototype['ErrorPacket'] = function(packet) {
  var err = this._packetToError(packet, true);
  err.fatal = true;
  this.end(err);
};
