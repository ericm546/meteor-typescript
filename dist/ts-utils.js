"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TsDiagnostics = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.normalizePath = normalizePath;
exports.getRootedPath = getRootedPath;
exports.prepareSourceMap = prepareSourceMap;
exports.getDepsAndRefs = getDepsAndRefs;
exports.createDiagnostics = createDiagnostics;
exports.hasErrors = hasErrors;
exports.isSourceMap = isSourceMap;
exports.isTypings = isTypings;
exports.getExcludeRegExp = getExcludeRegExp;

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _typescript = require("typescript");

var _typescript2 = _interopRequireDefault(_typescript);

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// 1) Normalizes slashes in the file path
// 2) Removes file extension
function normalizePath(filePath) {
  var resultName = filePath;
  if (_typescript2.default.fileExtensionIs(filePath, ".map")) {
    resultName = filePath.replace(/\.map$/, "");
  }
  return _typescript2.default.removeFileExtension(_typescript2.default.normalizeSlashes(resultName));
}

function getRootedPath(filePath) {
  if (_typescript2.default.getRootLength(filePath) === 0) {
    return "/" + filePath;
  }
  return filePath;
}

function prepareSourceMap(sourceMapContent, fileContent, sourceMapPath) {
  var sourceMapJson = JSON.parse(sourceMapContent);
  sourceMapJson.sourcesContent = [fileContent];
  sourceMapJson.sources = [sourceMapPath];
  return sourceMapJson;
}

/**
 * Gets all local modules given sourceFile imports types from.
 * Supports transitivity, i.e., if some module (directly imported)
 * re-exports types from another module, this another module
 * will be in the output too.
 */
function getDeps(sourceFile, checker) {
  var modules = [];

  function getModulePath(module) {
    if (!module) return null;

    var decl = module.declarations[0];
    var sf = decl.getSourceFile();
    if (sf && !sf.isDeclarationFile) {
      return sf.path;
    }
    return null;
  }

  function isExternal(module) {
    var decl = module.declarations[0];
    var sf = decl.getSourceFile();
    return sf.isDeclarationFile;
  }

  if (sourceFile.imports) {
    var paths = new Set();
    _underscore2.default.each(sourceFile.imports, function (importName) {
      var module = checker.getSymbolAtLocation(importName);
      if (module && !isExternal(module)) {
        var path = getModulePath(module);
        if (path) {
          paths.add(path);
        }
        var nodes = checker.getExportsOfModule(module);
        _underscore2.default.each(nodes, function (node) {
          if (node.parent && node.parent !== module) {
            var _path = getModulePath(node.parent);
            if (_path) {
              paths.add(_path);
            }
            return;
          }

          // If directly imported module re-uses and exports of a type
          // from another module, add this module to the dependency as well.
          var type = checker.getTypeAtLocation(node.declarations[0]);
          if (type && type.symbol) {
            var typeModule = type.symbol.parent;
            if (typeModule !== module) {
              var _path2 = getModulePath(typeModule);
              if (_path2) {
                paths.add(_path2);
              }
            }
          }
        });
      }
    });
    paths.forEach(function (path) {
      modules.push(path);
    });
  }

  return modules;
}

function getDepsAndRefs(sourceFile, typeChecker) {
  _assert2.default.ok(typeChecker);

  var modules = getDeps(sourceFile, typeChecker);
  var refs = getRefs(sourceFile);
  var mappings = getMappings(sourceFile);

  return {
    modules: modules,
    mappings: mappings,
    refFiles: refs.refFiles,
    refTypings: refs.refTypings
  };
}

function getMappings(sourceFile) {
  var mappings = [];
  if (sourceFile.resolvedModules) {
    var modules = sourceFile.resolvedModules;
    modules.forEach(function (module, modulePath) {
      mappings.push({
        modulePath: modulePath,
        resolvedPath: module ? _typescript2.default.removeFileExtension(module.resolvedFileName) : null,
        external: module ? module.isExternalLibraryImport : false,
        resolved: !!module
      });
    });
  }
  return mappings;
}

function getRefs(sourceFile) {
  // Collect referenced file paths, e.g.:
  // /// <reference path=".." />
  var refTypings = [],
      refFiles = [];
  if (sourceFile.referencedFiles) {
    var refPaths = sourceFile.referencedFiles.map(function (ref) {
      return ref.fileName;
    });
    refTypings = _underscore2.default.filter(refPaths, function (ref) {
      return isTypings(ref);
    });
    refFiles = _underscore2.default.filter(refPaths, function (ref) {
      return !isTypings(ref);
    });
  }

  // Collect resolved paths to referenced declaration types, e.g.:
  // /// <reference types=".." />
  if (sourceFile.resolvedTypeReferenceDirectiveNames) {
    var modules = sourceFile.resolvedTypeReferenceDirectiveNames;
    modules.forEach(function (ref, lib) {
      if (!ref) return;
      refTypings.push(ref.resolvedFileName);
    });
  }

  return {
    refFiles: refFiles,
    refTypings: refTypings
  };
}

function createDiagnostics(tsSyntactic, tsSemantic) {
  // Parse diagnostics to leave only info we need.
  var syntactic = flattenDiagnostics(tsSyntactic);
  var semantic = flattenDiagnostics(tsSemantic);
  return {
    syntacticErrors: syntactic,
    semanticErrors: semantic
  };
}

var TsDiagnostics = exports.TsDiagnostics = function () {
  function TsDiagnostics(diagnostics) {
    _classCallCheck(this, TsDiagnostics);

    _assert2.default.ok(this instanceof TsDiagnostics);
    _assert2.default.ok(diagnostics);
    (0, _utils.assertProps)(diagnostics, ["syntacticErrors", "semanticErrors"]);

    _underscore2.default.extend(this, diagnostics);
  }

  _createClass(TsDiagnostics, [{
    key: "hasErrors",
    value: function hasErrors() {
      return !!this.semanticErrors.length || !!this.syntacticErrors.length;
    }
  }, {
    key: "hasUnresolvedModules",
    value: function hasUnresolvedModules() {
      var index = _underscore2.default.findIndex(this.semanticErrors, function (msg) {
        return msg.code === _typescript2.default.Diagnostics.Cannot_find_module_0.code;
      });
      return index !== -1;
    }
  }]);

  return TsDiagnostics;
}();

function flattenDiagnostics(tsDiagnostics) {
  var diagnostics = [];

  var dLen = tsDiagnostics.length;
  for (var i = 0; i < dLen; i++) {
    var diagnostic = tsDiagnostics[i];
    if (!diagnostic.file) continue;

    var pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    var message = _typescript2.default.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    var line = pos.line + 1;
    var column = pos.character + 1;

    diagnostics.push({
      code: diagnostic.code,
      fileName: diagnostic.file.fileName,
      message: message,
      line: line,
      column: column
    });
  }

  return diagnostics;
}

function hasErrors(diagnostics) {
  if (!diagnostics) return true;

  return diagnostics.semanticErrors.length || diagnostics.syntacticErrors.length;
}

function isSourceMap(fileName) {
  return _typescript2.default.fileExtensionIs(fileName, ".map");
}

function isTypings(fileName) {
  return _typescript2.default.fileExtensionIs(fileName, ".d.ts");
}

function getExcludeRegExp(exclude) {
  if (!exclude) return exclude;

  return _typescript2.default.getRegularExpressionForWildcard(exclude, "", "exclude");
}