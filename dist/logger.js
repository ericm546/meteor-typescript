"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var util = require("util");

function Logger() {
  this.prefix = "[meteor-typescript]: ";
  this.llevel = process.env.TYPESCRIPT_LOG;
}

var LP = Logger.prototype;

LP.debug = function (format) {
  if (this.isDebug()) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    var msg = args.length ? util.format.apply(util, [format].concat(args)) : format;
    console.log(this.prefix + msg);
  }
};

LP.assert = function (format) {
  if (this.isAssert()) {
    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    var msg = args.length ? util.format.apply(util, [format].concat(args)) : format;
    console.log(this.prefix + msg);
  }
};

LP.isDebug = function () {
  return this.llevel >= 2;
};

LP.isProfile = function () {
  return this.llevel >= 3;
};

LP.isAssert = function () {
  return this.llevel >= 4;
};

LP.newProfiler = function (name) {
  var fullName = util.format("%s%s", this.prefix, name);
  var profiler = new Profiler(fullName);
  if (this.isProfile()) profiler.start();
  return profiler;
};

function Profiler(name) {
  this.name = name;
}

var PP = Profiler.prototype;

PP.start = function () {
  console.log("%s started", this.name);
  console.time(util.format("%s time", this.name));
  this._started = true;
};

PP.end = function () {
  if (this._started) {
    console.timeEnd(util.format("%s time", this.name));
  }
};

exports.default = new Logger();