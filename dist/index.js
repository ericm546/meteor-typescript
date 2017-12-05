'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TSBuild = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.setCacheDir = setCacheDir;
exports.compile = compile;
exports.validateAndConvertOptions = validateAndConvertOptions;
exports.getDefaultOptions = getDefaultOptions;

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _typescript = require("typescript");

var _typescript2 = _interopRequireDefault(_typescript);

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

var _options = require("./options");

var _compileService = require("./compile-service");

var _compileService2 = _interopRequireDefault(_compileService);

var _compileServiceHost = require("./compile-service-host");

var _compileServiceHost2 = _interopRequireDefault(_compileServiceHost);

var _filesSourceHost = require("./files-source-host");

var _filesSourceHost2 = _interopRequireDefault(_filesSourceHost);

var _cache = require("./cache");

var _logger = require("./logger");

var _logger2 = _interopRequireDefault(_logger);

var _utils = require("./utils");

var _tsUtils = require("./ts-utils");

var _refs = require("./refs");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var compileCache = void 0,
    fileHashCache = void 0;
function setCacheDir(cacheDir) {
  if (compileCache && compileCache.cacheDir === cacheDir) {
    return;
  }

  compileCache = new _cache.CompileCache(cacheDir);
  fileHashCache = new _cache.FileHashCache(cacheDir);
}

function getConvertedDefault(arch) {
  return (0, _options.convertCompilerOptionsOrThrow)((0, _options.getDefaultCompilerOptions)(arch));
}

function isES6Target(target) {
  return (/es6/i.test(target) || /es2015/i.test(target)
  );
}

function evalCompilerOptions(arch, opt) {
  var defOpt = (0, _options.getDefaultCompilerOptions)(arch);
  var resOpt = opt || defOpt;

  _underscore2.default.defaults(resOpt, defOpt);
  // Add target to the lib since
  // if target: "es6" and lib: ["es5"],
  // it won't compile properly.
  if (resOpt.target) {
    resOpt.lib.push(resOpt.target);
  }
  resOpt.lib = _underscore2.default.union(resOpt.lib, defOpt.lib);

  // Impose use strict for ES6 target.
  if (opt && opt.noImplicitUseStrict !== undefined) {
    if (isES6Target(resOpt.target)) {
      resOpt.noImplicitUseStrict = false;
    }
  }

  return resOpt;
}

function lazyInit() {
  if (!compileCache) {
    setCacheDir();
  }
}

// A map of TypeScript Language Services
// per each Meteor architecture.
var serviceMap = {};
function getCompileService(arch) {
  if (!arch) arch = "global";
  if (serviceMap[arch]) return serviceMap[arch];

  var serviceHost = new _compileServiceHost2.default(fileHashCache);
  var service = new _compileService2.default(serviceHost);
  serviceMap[arch] = service;
  return service;
}

/**
 * Class that represents an incremental TypeScript build (compilation).
 * For the typical usage in a Meteor compiler plugin,
 * see a TypeScript compiler that based on this NPM:
 * https://github.com/barbatus/typescript-compiler/blob/master/typescript-compiler.js#L58
 *
 * @param filePaths Paths of the files to compile.
 * @param getFileContent Method that takes a file path
 *  and returns that file's content. To be used to pass file contents
 *  from a Meteor compiler plugin to the TypeScript compiler.
 * @param options Object with the options of the TypeSctipt build.
 *   Available options:
 *    - compilerOptions: TypeScript compiler options
 *    - arch: Meteor file architecture
 *    - useCache: whether to use cache 
 */

var TSBuild = exports.TSBuild = function () {
  function TSBuild(filePaths, getFileContent) {
    var _this = this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    _classCallCheck(this, TSBuild);

    _logger2.default.debug("new build");

    var compilerOptions = evalCompilerOptions(options.arch, options.compilerOptions);
    var resOptions = _extends({}, options, { compilerOptions: compilerOptions });
    resOptions = validateAndConvertOptions(resOptions);
    resOptions.compilerOptions = (0, _options.presetCompilerOptions)(resOptions.compilerOptions);
    this.options = resOptions;

    lazyInit();

    _filesSourceHost2.default.setSource(getFileContent);

    var pset = _logger2.default.newProfiler("set files");
    var compileService = getCompileService(resOptions.arch);
    var serviceHost = compileService.getHost();
    serviceHost.setFiles(filePaths, resOptions);
    pset.end();

    var prefs = _logger2.default.newProfiler("refs eval");
    this.refsChangeMap = (0, _refs.evalRefsChangeMap)(filePaths, function (filePath) {
      return serviceHost.isFileChanged(filePath);
    }, function (filePath) {
      var csResult = compileCache.getResult(filePath, _this.getFileOptions(filePath));
      return csResult ? csResult.dependencies : null;
    }, resOptions.evalDepth || 1);
    prefs.end();
  }

  _createClass(TSBuild, [{
    key: "getFileOptions",
    value: function getFileOptions(filePath) {
      // Omit arch to avoid re-compiling same files aimed for diff arch.
      // Prepare file options which besides general ones
      // should contain a module name.
      var options = _underscore2.default.omit(this.options, "arch", "useCache", "evalDepth");
      var module = options.compilerOptions.module;
      var moduleName = module === "none" ? null : _typescript2.default.removeFileExtension(filePath);
      return { options: options, moduleName: moduleName };
    }
  }, {
    key: "emit",
    value: function emit(filePath) {
      var _this2 = this;

      _logger2.default.debug("emit file %s", filePath);

      var options = this.options;
      var compileService = getCompileService(options.arch);

      var serviceHost = compileService.getHost();
      if (!serviceHost.hasFile(filePath)) {
        throw new Error("File " + filePath + " not found");
      }

      var csOptions = this.getFileOptions(filePath);

      function compile() {
        var pcomp = _logger2.default.newProfiler("compile " + filePath);
        var result = compileService.compile(filePath, csOptions.moduleName);
        pcomp.end();
        return result;
      }

      var useCache = options.useCache;
      if (useCache === false) {
        return compile();
      }

      var isTypingsChanged = serviceHost.isTypingsChanged();
      var pget = _logger2.default.newProfiler("compileCache get");
      var result = compileCache.get(filePath, csOptions, function (cacheResult) {
        if (!cacheResult) {
          _logger2.default.debug("cache miss: %s", filePath);
          return compile();
        }

        var refsChange = _this2.refsChangeMap[filePath];

        // Referenced files have changed, which may need recompilation in some cases.
        // See https://github.com/Urigo/angular2-meteor/issues/102#issuecomment-191411701
        if (refsChange === _refs.RefsChangeType.FILES) {
          _logger2.default.debug("recompile: %s", filePath);
          return compile();
        }

        // Diagnostics re-evaluation.
        // First case: file is not changed but contains unresolved modules
        // error from previous build (some node modules might have installed).
        // Second case: dependency modules or typings have changed.
        // const csResult = createCSResult(filePath, cacheResult);
        // const tsDiag = csResult.diagnostics;
        // const unresolved = tsDiag.hasUnresolvedModules();
        // if (unresolved || refsChange !== RefsChangeType.NONE || isTypingsChanged) {
        //   logger.debug("diagnostics re-evaluation: %s", filePath);
        //   const pdiag = logger.newProfiler("diags update");
        //   csResult.upDiagnostics(
        //     compileService.getDiagnostics(filePath));
        //   pdiag.end();
        //   return csResult;
        // }
        // Cached result is up to date, no action required.
        _logger2.default.debug("file from cached: %s", filePath);
        return null;
      });
      pget.end();

      return result;
    }
  }]);

  return TSBuild;
}();

function compile(fileContent) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (typeof fileContent !== "string") {
    throw new Error("fileContent should be a string");
  }

  var optPath = options.filePath;
  if (!optPath) {
    optPath = (0, _utils.deepHash)(fileContent, options);
    var tsx = options.compilerOptions && options.compilerOptions.jsx;
    optPath += tsx ? ".tsx" : ".ts";
  }

  var getFileContent = function getFileContent(filePath) {
    if (filePath === optPath) {
      return fileContent;
    }
  };

  var newBuild = new TSBuild([optPath], getFileContent, options);
  return newBuild.emit(optPath);
};

var validOptions = {
  "compilerOptions": "Object",
  // Next three to be used mainly
  // in the compile method above.
  "filePath": "String",
  "typings": "Array",
  "arch": "String",
  "useCache": "Boolean",
  "evalDepth": "Number"
};
var validOptionsMsg = "Valid options are compilerOptions, filePath, and typings.";

function checkType(option, optionName) {
  if (!option) return true;

  return option.constructor.name === validOptions[optionName];
}

function validateAndConvertOptions(options) {
  if (!options) return null;

  // Validate top level options.
  for (var option in options) {
    if (options.hasOwnProperty(option)) {
      if (validOptions[option] === undefined) {
        throw new Error("Unknown option: " + option + ".\n" + validOptionsMsg);
      }

      if (!checkType(options[option], option)) {
        throw new Error(option + " should be of type " + validOptions[option]);
      }
    }
  }

  var resOptions = _underscore2.default.clone(options);
  // Validate and convert compilerOptions.
  if (options.compilerOptions) {
    resOptions.compilerOptions = (0, _options.convertCompilerOptionsOrThrow)(options.compilerOptions);
  }

  return resOptions;
}

function getDefaultOptions(arch) {
  return {
    compilerOptions: (0, _options.getDefaultCompilerOptions)(arch)
  };
}

exports.validateTsConfig = _options.validateTsConfig;

exports.getExcludeRegExp = _tsUtils.getExcludeRegExp;