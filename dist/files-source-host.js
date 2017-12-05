"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typescript = require("typescript");

var _typescript2 = _interopRequireDefault(_typescript);

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ROOTED = /^(\/|\\)/;

var SourceHost = function () {
  function SourceHost() {
    _classCallCheck(this, SourceHost);
  }

  _createClass(SourceHost, [{
    key: "setSource",
    value: function setSource(fileSource) {
      this.fileSource = fileSource;
    }
  }, {
    key: "get",
    value: function get(filePath) {
      if (this.fileSource) {
        var source = this.fileSource(filePath);
        if (_underscore2.default.isString(source)) return source;
      }

      return null;
    }
  }, {
    key: "normalizePath",
    value: function normalizePath(filePath) {
      if (!filePath) return null;

      return filePath.replace(ROOTED, '');
    }
  }]);

  return SourceHost;
}();

module.exports = new SourceHost();