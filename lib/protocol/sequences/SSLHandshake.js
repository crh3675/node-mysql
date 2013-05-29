var Sequence = require('./Sequence');
var Util     = require('util');
var Packets  = require('../packets');
var Auth     = require('../Auth');

module.exports = SSLHandshake;
Util.inherits(SSLHandshake, Sequence);
function SSLHandshake(config, callback) {
  Sequence.call(this, callback);

  this._config                        = config;
  this._handshakeInitializationPacket = null;
  this._sslConnectPacket = null;
}

SSLHandshake.prototype.determinePacket = function(firstByte, parser) {

  if (firstByte === 0xff) {
    return Packets.ErrorPacket;
  }

   if(!this._sslConnectPacket)
   {
      return Packets.SSLConnectPacket;      
   
   }


  if (firstByte === 0xfe) {
    return Packets.UseOldPasswordPacket;
  }
};


SSLHandshake.prototype['SSLConnectPacket'] = function(packet) {

  this._config.protocol41 = packet.protocol41;
  
  this._handshakeInitializationPacket = packet;   

  this.emit('packet', new Packets.SSLConnectPacket({
    clientFlags   : this._config.clientFlags,
    maxPacketSize : this._config.maxPacketSize,
    charsetNumber : this._config.charsetNumber,
    protocol41    : this._config.protocol41          
  }));

};

SSLHandshake.prototype['ErrorPacket'] = function(packet) {
  var err = this._packetToError(packet, true);
  err.fatal = true;
  this.end(err);
};
