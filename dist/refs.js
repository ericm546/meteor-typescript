"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RefsChangeType = undefined;
exports.evalRefsChangeMap = evalRefsChangeMap;

var _logger = require("./logger");

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var RefsChangeType = exports.RefsChangeType = {
  NONE: 0,
  FILES: 1,
  MODULES: 2,
  TYPINGS: 3
};

function evalRefsChangeMap(filePaths, isFileChanged, getRefs, maxDepth) {
  var refsChangeMap = {};
  filePaths.forEach(function (filePath) {
    if (refsChangeMap[filePath]) return;
    refsChangeMap[filePath] = evalRefsChange(filePath, isFileChanged, getRefs, refsChangeMap, maxDepth);
    _logger2.default.assert("set ref changes: %s %s", filePath, refsChangeMap[filePath]);
  });
  return refsChangeMap;
}

function evalRefsChange(filePath, isFileChanged, getRefs, refsChangeMap, depth) {
  // Depth of deps analysis.
  if (depth === 0) {
    return RefsChangeType.NONE;
  }

  var refs = getRefs(filePath);
  if (!refs) {
    refsChangeMap[filePath] = RefsChangeType.NONE;
    return RefsChangeType.NONE;
  }

  var refsChange = isRefsChanged(filePath, isFileChanged, refs);
  if (refsChange !== RefsChangeType.NONE) {
    refsChangeMap[filePath] = refsChange;
    return refsChange;
  }

  var modules = refs.modules;
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = modules[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var mPath = _step.value;

      var result = refsChangeMap[mPath];
      if (result === undefined) {
        result = evalRefsChange(mPath, isFileChanged, getRefs, refsChangeMap, depth - 1);
      }
      if (result !== RefsChangeType.NONE) {
        refsChangeMap[filePath] = RefsChangeType.MODULES;
        return RefsChangeType.MODULES;
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  refsChangeMap[filePath] = RefsChangeType.NONE;
  return RefsChangeType.NONE;
}

function isRefsChanged(filePath, isFileChanged, refs) {
  function isFilesChanged(files) {
    if (!files) return false;

    var tLen = files.length;
    for (var i = 0; i < tLen; i++) {
      if (isFileChanged(files[i])) {
        return true;
      }
    }
    return false;
  }

  if (refs) {
    var typings = refs.refTypings;
    if (isFilesChanged(typings)) {
      _logger2.default.debug("referenced typings changed in %s", filePath);
      return RefsChangeType.TYPINGS;
    }

    var files = refs.refFiles;
    if (isFilesChanged(files)) {
      _logger2.default.debug("referenced files changed in %s", filePath);
      return RefsChangeType.FILES;
    }

    var modules = refs.modules;
    if (isFilesChanged(modules)) {
      _logger2.default.debug("imported module changed in %s", filePath);
      return RefsChangeType.MODULES;
    }
  }

  return RefsChangeType.NONE;
}