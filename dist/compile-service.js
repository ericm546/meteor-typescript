"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CSResult = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.createCSResult = createCSResult;

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _typescript = require("typescript");

var _typescript2 = _interopRequireDefault(_typescript);

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

var _logger = require("./logger");

var _logger2 = _interopRequireDefault(_logger);

var _filesSourceHost = require("./files-source-host");

var _filesSourceHost2 = _interopRequireDefault(_filesSourceHost);

var _tsUtils = require("./ts-utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CompileService = function () {
  function CompileService(serviceHost) {
    _classCallCheck(this, CompileService);

    this.serviceHost = serviceHost;
    this.service = _typescript2.default.createLanguageService(serviceHost);
  }

  _createClass(CompileService, [{
    key: "compile",
    value: function compile(filePath, moduleName) {
      var sourceFile = this.getSourceFile(filePath);
      _assert2.default.ok(sourceFile);

      if (moduleName) {
        sourceFile.moduleName = moduleName;
      }

      var result = this.service.getEmitOutput(filePath);

      var code = void 0,
          sourceMap = void 0;
      _underscore2.default.each(result.outputFiles, function (file) {
        if ((0, _tsUtils.normalizePath)(filePath) !== (0, _tsUtils.normalizePath)(file.name)) return;

        var text = file.text;
        if ((0, _tsUtils.isSourceMap)(file.name)) {
          var source = _filesSourceHost2.default.get(filePath);
          sourceMap = (0, _tsUtils.prepareSourceMap)(text, source, filePath);
        } else {
          code = text;
        }
      }, this);

      var checker = this.getTypeChecker();
      var pcs = _logger2.default.newProfiler("process csresult");
      var deps = (0, _tsUtils.getDepsAndRefs)(sourceFile, checker);
      var meteorizedCode = this.rootifyPaths(code, deps.mappings);
      var csResult = createCSResult(filePath, {
        code: meteorizedCode,
        sourceMap: sourceMap,
        version: this.serviceHost.getScriptVersion(filePath),
        isExternal: _typescript2.default.isExternalModule(sourceFile),
        dependencies: deps,
        diagnostics: this.getDiagnostics(filePath)
      });
      pcs.end();

      return csResult;
    }
  }, {
    key: "getHost",
    value: function getHost() {
      return this.serviceHost;
    }
  }, {
    key: "getDocRegistry",
    value: function getDocRegistry() {
      return this.registry;
    }
  }, {
    key: "getSourceFile",
    value: function getSourceFile(filePath) {
      var program = this.service.getProgram();
      return program.getSourceFile(filePath);
    }
  }, {
    key: "getDepsAndRefs",
    value: function getDepsAndRefs(filePath) {
      var checker = this.getTypeChecker();
      return (0, _tsUtils.getDepsAndRefs)(this.getSourceFile(filePath), checker);
    }
  }, {
    key: "getRefTypings",
    value: function getRefTypings(filePath) {
      var refs = (0, _tsUtils.getRefs)(this.getSourceFile(filePath));
      return refs.refTypings;
    }
  }, {
    key: "getTypeChecker",
    value: function getTypeChecker() {
      return this.service.getProgram().getTypeChecker();
    }
  }, {
    key: "getDiagnostics",
    value: function getDiagnostics(filePath) {
      return {
        syntacticErrors: [],
        semanticErrors: []
      };
    }
  }, {
    key: "rootifyPaths",
    value: function rootifyPaths(code, mappings) {
      function buildPathRegExp(modulePath) {
        var regExp = new RegExp("(require\\(\"|\')(" + modulePath + ")(\"|\'\\))", "g");
        return regExp;
      }

      mappings = mappings.filter(function (module) {
        return module.resolved && !module.external;
      });
      _logger2.default.assert("process mappings %s", mappings.map(function (module) {
        return module.resolvedPath;
      }));
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        var _loop = function _loop() {
          var module = _step.value;

          var usedPath = module.modulePath;
          var resolvedPath = module.resolvedPath;

          // Fix some weird v2.1.x bug where
          // LanguageService converts dotted paths
          // to relative in the code.
          var regExp = buildPathRegExp(resolvedPath);
          code = code.replace(regExp, function (match, p1, p2, p3, offset) {
            return p1 + (0, _tsUtils.getRootedPath)(resolvedPath) + p3;
          });

          // Skip path replacement for dotted paths.
          if (!usedPath.startsWith(".")) {
            var _regExp = buildPathRegExp(usedPath);
            code = code.replace(_regExp, function (match, p1, p2, p3, offset) {
              return p1 + (0, _tsUtils.getRootedPath)(resolvedPath) + p3;
            });
          }
        };

        for (var _iterator = mappings[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          _loop();
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

      return code;
    }
  }]);

  return CompileService;
}();

exports.default = CompileService;
function createCSResult(filePath, result) {
  var props = ["code", "sourceMap", "version", "isExternal", "dependencies"];
  var len = props.length;
  for (var i = 0; i < len; i++) {
    if (!_underscore2.default.has(result, props[i])) {
      var msg = "file result " + filePath + " doesn't contain " + props[i];
      _logger2.default.debug(msg);
      throw new Error(msg);
    }
  }
  result.diagnostics = new _tsUtils.TsDiagnostics(result.diagnostics);

  return new CSResult(result);
}

var CSResult = exports.CSResult = function () {
  function CSResult(result) {
    _classCallCheck(this, CSResult);

    _assert2.default.ok(this instanceof CSResult);

    _underscore2.default.extend(this, result);
  }

  _createClass(CSResult, [{
    key: "upDiagnostics",
    value: function upDiagnostics(diagnostics) {
      this.diagnostics = new _tsUtils.TsDiagnostics(diagnostics);
    }
  }]);

  return CSResult;
}();