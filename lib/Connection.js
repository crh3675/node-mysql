var Net              = require('net');
var ConnectionConfig = require('./ConnectionConfig');
var Pool             = require('./Pool');
var Protocol         = require('./protocol/Protocol');
var SqlString        = require('./protocol/SqlString');
var Query            = require('./protocol/sequences/Query');
var EventEmitter     = require('events').EventEmitter;
var Util             = require('util');
var TLS              = require('tls');

module.exports = Connection;
Util.inherits(Connection, EventEmitter);
function Connection(options) {
  EventEmitter.call(this);

  this.config = options.config;

  this._socket        = options.socket;
  this._protocol      = new Protocol({config: this.config, connection: this});
  this._connectCalled = false;
  this.state          = "disconnected";
}

Connection.createQuery = function(sql, values, cb) {
  if (sql instanceof Query) {
    return sql;
  }

  var options = {};

  if (typeof sql === 'object') {
    // query(options, cb)
    options = sql;
    if (typeof values === 'function') {
      cb = values;
    } else {
      options.values = values;
    }
  } else if (typeof values === 'function') {
    // query(sql, cb)
    cb             = values;
    options.sql    = sql;
    options.values = undefined;
  } else {
    // query(sql, values, cb)
    options.sql    = sql;
    options.values = values;
  }
  return new Query(options, cb);
};

Connection.prototype.connect = function(cb) {
  if (!this._connectCalled) {
    this._connectCalled = true;
    
    var self = this;
    
    var continueConnect = function(){

      // Node v0.10+ Switch socket into "old mode" (Streams2)
      self._socket.on("data",function() {});

      self._socket.pipe(self._protocol);
      self._protocol.pipe(self._socket);

      self._socket.on('error', self._handleNetworkError.bind(self));
      self._protocol.on('handshake', self._handleProtocolHandshake.bind(self));
      self._protocol.on('unhandledError', self._handleProtocolError.bind(self));
      self._protocol.on('drain', self._handleProtocolDrain.bind(self));
      self._protocol.on('end', self._handleProtocolEnd.bind(self));
    
    }
    
    if(Object.getOwnPropertyNames(self.config.ssl).length > 0)
    { 
      var ssloptions = {
         port: self.config.port,
         host: self.config.host,
         NPNProtocols: [ 'ssl/1.0', 'ssl/2', 'ssl/3', 'http/1.1', 'spdy/2', 'tls/1', 'tls/1.1', 'tls/1.2' ]
      };
      
      for(var key in self.config.ssl)
      {
         ssloptions[key] = self.config.ssl[key];
      }
    
      self._socket = TLS.connect(ssloptions, function(self){
        
          self.state = "connected";
        
          self._protocol.sslconnect(function(){
             self._protocol.handshake(cb);
          });
      });
      
      continueConnect.call(self);
    }
    else
    {
      self._socket = (self.config.socketPath)
        ? Net.createConnection(self.config.socketPath)
        : Net.createConnection(self.config.port, self.config.host);
        
      self._socket.on('connect', self._handleProtocolConnect.bind(self));
      
      continueConnect.call(self);
      
      self._protocol.handshake(cb);
    }
  }
};

Connection.prototype.changeUser = function(options, cb){
  this._implyConnect();

  if (typeof options === 'function') {
    cb      = options;
    options = {};
  }

  var charsetNumber = (options.charset)
    ? Config.getCharsetNumber(options.charset)
    : this.config.charsetNumber;

  return this._protocol.changeUser({
    user          : options.user || this.config.user,
    password      : options.password || this.config.password,
    database      : options.database || this.config.database,
    charsetNumber : charsetNumber,
    currentConfig : this.config
  }, cb);
};

Connection.prototype.query = function(sql, values, cb) {
  this._implyConnect();

  var query = Connection.createQuery(sql, values, cb);
  query._connection = this;

  if (!(typeof sql == 'object' && 'typeCast' in sql)) {
    query.typeCast = this.config.typeCast;
  }

  query.sql = this.format(query.sql, query.values || []);
  delete query.values;

  return this._protocol._enqueue(query);
};

Connection.prototype.ping = function(cb) {
  this._implyConnect();
  this._protocol.ping(cb);
};

Connection.prototype.statistics = function(cb) {
  this._implyConnect();
  this._protocol.stats(cb);
};

Connection.prototype.end = function(cb) {
  this._implyConnect();
  this._protocol.quit(cb);
};

Connection.prototype.destroy = function() {
  this.state = "disconnected";
  this._implyConnect();
  this._socket.destroy();
  this._protocol.destroy();
};

Connection.prototype.pause = function() {
  this._socket.pause();
  this._protocol.pause();
};

Connection.prototype.resume = function() {
  this._socket.resume();
  this._protocol.resume();
};

Connection.prototype.escape = function(value) {
  return SqlString.escape(value, false, this.config.timezone);
};

Connection.prototype.format = function(sql, values) {
  if (typeof this.config.queryFormat == "function") {
    return this.config.queryFormat.call(this, sql, values, this.config.timezone);
  }
  return SqlString.format(sql, values, this.config.timezone);
};

Connection.prototype._handleNetworkError = function(err) {
  this._protocol.handleNetworkError(err);
};

Connection.prototype._handleProtocolError = function(err) {
  this.state = "protocol_error";
  this.emit('error', err);
};

Connection.prototype._handleProtocolDrain = function() {
  this.emit('drain');
};

Connection.prototype._handleProtocolConnect = function() {
  this.state = "connected";
};

Connection.prototype._handleProtocolHandshake = function() {
  this.state = "authenticated";
};

Connection.prototype._handleProtocolEnd = function(err) {
  this.state = "disconnected";
  this.emit('end', err);
};

Connection.prototype._implyConnect = function() {
  if (!this._connectCalled) {
    this.connect();
  }
};
