"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typescript = require("typescript");

var _typescript2 = _interopRequireDefault(_typescript);

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

var _utils = require("./utils");

var _tsUtils = require("./ts-utils");

var _logger = require("./logger");

var _logger2 = _interopRequireDefault(_logger);

var _filesSourceHost = require("./files-source-host");

var _filesSourceHost2 = _interopRequireDefault(_filesSourceHost);

var _scriptSnapshot = require("./script-snapshot");

var _scriptSnapshot2 = _interopRequireDefault(_scriptSnapshot);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CompileServiceHost = function () {
  function CompileServiceHost(fileCache) {
    _classCallCheck(this, CompileServiceHost);

    this.files = {};
    this.fileCache = fileCache;
    this.fileContentMap = new Map();
    this.typingsChanged = false;
    this.appId = this.curDir = _typescript2.default.sys.getCurrentDirectory();
  }

  _createClass(CompileServiceHost, [{
    key: "setFiles",
    value: function setFiles(filePaths, options) {
      this.options = options;
      this.filePaths = filePaths;

      var typings = [];
      var arch = options && options.arch;
      _underscore2.default.each(filePaths, function (filePath) {
        if (!this.files[filePath]) {
          this.files[filePath] = { version: 0 };
        }

        // Collect typings in order to set them later.
        if ((0, _tsUtils.isTypings)(filePath)) {
          typings.push(filePath);
        }

        var source = _filesSourceHost2.default.get(filePath);
        this.files[filePath].changed = false;
        // Use file path with the current dir for the cache
        // to avoid same file names coincidences between apps.
        var fullPath = _typescript2.default.combinePaths(this.curDir, filePath);
        var fileChanged = this.fileCache.isChanged(fullPath, arch, source);
        if (fileChanged) {
          this.files[filePath].version++;
          this.files[filePath].changed = true;
          this.fileCache.save(fullPath, arch, source);
          return;
        }
      }, this);

      this.setTypings(typings, options);
    }
  }, {
    key: "setTypings",
    value: function setTypings(typings, options) {
      var dtsMap = {};
      var arch = options && options.arch;
      var typingsChanged = false;
      for (var i = 0; i < typings.length; i++) {
        var filePath = typings[i];
        if (this.hasFile(filePath)) {
          dtsMap[filePath] = true;
          if (this.isFileChanged(filePath)) {
            _logger2.default.debug("declaration file %s changed", filePath);
            typingsChanged = true;
          }
          continue;
        }
        var fullPath = _typescript2.default.combinePaths(this.curDir, filePath);
        var source = this.readFile(fullPath);
        if (source) {
          dtsMap[filePath] = true;
          var fileChanged = this.fileCache.isChanged(fullPath, arch, source);
          if (fileChanged) {
            this.fileCache.save(fullPath, arch, source);
            _logger2.default.debug("declaration file %s changed", filePath);
            typingsChanged = true;
          }
        }
      }

      // Investigate if the number of declaration files have changed.
      // In the positive case, we'll need to revaluate diagnostics
      // for all files of specific architecture.
      if (arch) {
        // Check if typings map differs from the previous value.
        var mapChanged = this.fileCache.isChanged(this.appId, arch, dtsMap);
        if (mapChanged) {
          _logger2.default.debug("typings of %s changed", arch);
          typingsChanged = mapChanged;
        }
        this.fileCache.save(this.appId, arch, dtsMap);
      }

      this.typingsChanged = typingsChanged;
    }
  }, {
    key: "isFileChanged",
    value: function isFileChanged(filePath) {
      var normPath = _filesSourceHost2.default.normalizePath(filePath);
      var file = this.files[normPath];
      return file && file.changed;
    }
  }, {
    key: "hasFile",
    value: function hasFile(filePath) {
      var normPath = _filesSourceHost2.default.normalizePath(filePath);
      return !!this.files[normPath];
    }
  }, {
    key: "isTypingsChanged",
    value: function isTypingsChanged() {
      return this.typingsChanged;
    }
  }, {
    key: "getScriptFileNames",
    value: function getScriptFileNames() {
      var rootFilePaths = {};
      for (var filePath in this.files) {
        rootFilePaths[filePath] = true;
      }

      // Add in options.typings, which is used
      // to set up typings that should be read from disk.
      var typings = this.options.typings;
      if (typings) {
        _underscore2.default.each(typings, function (filePath) {
          if (!rootFilePaths[filePath]) {
            rootFilePaths[filePath] = true;
          }
        });
      }

      return _underscore2.default.keys(rootFilePaths);
    }
  }, {
    key: "getScriptVersion",
    value: function getScriptVersion(filePath) {
      var normPath = _filesSourceHost2.default.normalizePath(filePath);
      return this.files[normPath] && this.files[normPath].version.toString();
    }
  }, {
    key: "getScriptSnapshot",
    value: function getScriptSnapshot(filePath) {
      var source = _filesSourceHost2.default.get(filePath);
      if (source !== null) {
        return new _scriptSnapshot2.default(source);
      }

      var fileContent = this.readFile(filePath);
      return fileContent ? new _scriptSnapshot2.default(fileContent) : null;
    }
  }, {
    key: "readDirectory",
    value: function readDirectory() {
      var _ts$sys;

      return (_ts$sys = _typescript2.default.sys).readDirectory.apply(_ts$sys, arguments);
    }
  }, {
    key: "fileExists",
    value: function fileExists(filePath) {
      var normPath = _filesSourceHost2.default.normalizePath(filePath);
      if (this.files[normPath]) return true;

      var fileContent = this.fileContentMap.get(filePath);
      if (fileContent) return true;

      return _typescript2.default.sys.fileExists(filePath);
    }
  }, {
    key: "readFile",
    value: function readFile(filePath) {
      // Read node_modules files optimistically.
      var fileContent = this.fileContentMap.get(filePath);
      if (!fileContent) {
        fileContent = _typescript2.default.sys.readFile(filePath, "utf-8");
        this.fileContentMap.set(filePath, fileContent);
      }
      return fileContent;
    }
  }, {
    key: "getCompilationSettings",
    value: function getCompilationSettings() {
      return this.options.compilerOptions;
    }
  }, {
    key: "getDefaultLibFileName",
    value: function getDefaultLibFileName() {
      var libName = _typescript2.default.getDefaultLibFilePath(this.getCompilationSettings());
      return libName;
    }

    // Returns empty since we process for simplicity
    // file paths relative to the Meteor app.

  }, {
    key: "getCurrentDirectory",
    value: function getCurrentDirectory() {
      return "";
    }
  }, {
    key: "useCaseSensitiveFileNames",
    value: function useCaseSensitiveFileNames() {
      return true;
    }
  }]);

  return CompileServiceHost;
}();

exports.default = CompileServiceHost;