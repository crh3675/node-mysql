module.exports = SSLConnectPacket;
function SSLConnectPacket(options) {
  options = options || {};
  
  this.clientFlags   = options.clientFlags;
  this.maxPacketSize = options.maxPacketSize;
  this.charsetNumber = options.charsetNumber;
  this.filler        = undefined;
  this.protocol41    = options.protocol41;
  this.enableTLS     = true;
}

SSLConnectPacket.prototype.parse = function(parser) {

  this.protocolVersion     = parser.parseUnsignedNumber(1);
  this.serverVersion       = parser.parseNullTerminatedString();
  this.threadId            = parser.parseUnsignedNumber(4);
  this.scrambleBuff1       = parser.parseBuffer(8);
  this.filler1             = parser.parseFiller(1);
  this.serverCapabilities1 = parser.parseUnsignedNumber(2);
  this.serverLanguage      = parser.parseUnsignedNumber(1);
  this.serverStatus        = parser.parseUnsignedNumber(2);

  this.protocol41          = (this.serverCapabilities1 & (1 << 9)) > 0;

  if (this.protocol41) {
    this.serverCapabilities2 = parser.parseUnsignedNumber(2);
    this.scrambleLength      = parser.parseUnsignedNumber(1);
    this.filler2             = parser.parseFiller(10);
    // scrambleBuff2 should be 0x00 terminated, but sphinx does not do this
    // so we assume scrambleBuff2 to be 12 byte and treat the next byte as a
    // filler byte.
    this.scrambleBuff2       = parser.parseBuffer(12);
    this.filler3             = parser.parseFiller(1);
  } else {
    this.filler2             = parser.parseFiller(13);
  }

  if (parser.reachedPacketEnd()) {
    return;
  }

  // According to the docs this should be 0x00 terminated, but MariaDB does
  // not do this, so we assume this string to be packet terminated.
  this.pluginData = parser.parsePacketTerminatedString();

  // However, if there is a trailing '\0', strip it
  var lastChar = this.pluginData.length - 1;
  if (this.pluginData[lastChar] === '\0') {
    this.pluginData = this.pluginData.substr(0, lastChar);
  }
/*
  this.clientFlags   = parser.parseUnsignedNumber(4);
  this.maxPacketSize = parser.parseUnsignedNumber(4);
  this.charsetNumber = parser.parseUnsignedNumber(1);
  this.filler        = parser.parseFiller(23);*/
};

SSLConnectPacket.prototype.write = function(writer) {

   if(this.protocol41)
   {
      writer.writeUnsignedNumber(4, this.clientFlags);
      writer.writeUnsignedNumber(4, this.maxPacketSize);
      writer.writeUnsignedNumber(1, this.charsetNumber);
      writer.writeFiller(23);
   }
   else
   {
      writer.writeUnsignedNumber(4, this.clientFlags);   
   }
};

