"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typescript = require("typescript");

var _typescript2 = _interopRequireDefault(_typescript);

var _diff = require("diff");

var jsdiff = _interopRequireWildcard(_diff);

var _logger = require("./logger");

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var StringScriptSnapshot = function () {
  function StringScriptSnapshot(text) {
    _classCallCheck(this, StringScriptSnapshot);

    this.text = text;
  }

  _createClass(StringScriptSnapshot, [{
    key: "getText",
    value: function getText(start, end) {
      return this.text.substring(start, end);
    }
  }, {
    key: "getLength",
    value: function getLength() {
      return this.text.length;
    }
  }, {
    key: "getChangeRange",
    value: function getChangeRange(oldSnapshot) {
      if (!oldSnapshot) return undefined;

      var diffs = jsdiff.diffChars(oldSnapshot.text, this.text);
      if (diffs.length) {
        var ind = 0;
        var changes = [];
        for (var i = 0; i < diffs.length; i++) {
          var diff = diffs[i];

          if (diff.added) {
            changes.push(_typescript2.default.createTextChangeRange(_typescript2.default.createTextSpan(ind, 0), diff.count));
            ind += diff.count;
            continue;
          }

          if (diff.removed) {
            changes.push(_typescript2.default.createTextChangeRange(_typescript2.default.createTextSpan(ind, diff.count), 0));
            continue;
          }

          ind += diff.count;
        }

        changes = _typescript2.default.collapseTextChangeRangesAcrossMultipleVersions(changes);
        _logger2.default.assert("accumulated file changes %j", changes);

        return changes;
      }

      return _typescript2.default.createTextChangeRange(_typescript2.default.createTextSpan(0, 0), 0);
    }
  }]);

  return StringScriptSnapshot;
}();

exports.default = StringScriptSnapshot;