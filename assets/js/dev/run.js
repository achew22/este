// Generated by CoffeeScript 1.4.0
/**
  @fileoverview One script to automatically compile and watch CoffeeScript,
  Stylus, and Soy templates. Run fast unit test on source files change. No need
  to take care about ordered list of project files with Closure dependency
  system. LiveReload supported.

  Todo
    rewrite this (legacy) mess into good code in Este style
*/

var Commands, booting, clearScreen, coffeeForClosure, commandsRunning, depsNamespaces, esprima, exec, extractMessages, fs, getMessage, getMessageDescription, getPaths, getProjectPaths, getSoyCommand, http, insertMessages, isClosureCompilationError, jsSubdirs, lazyRequireCoffeeForClosure, notifyClient, onPathChange, options, pathModule, runCommands, setOptions, socket, sortTokens, start, startServer, startTime, tests, watchOptions, watchPaths, wrench, ws,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

fs = require('fs');

exec = require('child_process').exec;

tests = require('./tests');

http = require('http');

pathModule = require('path');

ws = require('websocket.io');

esprima = require('esprima');

wrench = require('wrench');

(function() {
  var googBasePath, googNodeBasePath, nodeBase;
  googBasePath = './assets/js/google-closure/closure/goog/base.js';
  googNodeBasePath = './assets/js/dev/nodebase.js';
  nodeBase = fs.readFileSync(googBasePath, 'utf8');
  nodeBase = nodeBase.replace('var goog = goog || {};', 'global.goog = global.goog || {};');
  nodeBase = nodeBase.replace('goog.global = this;', 'goog.global = global;');
  fs.writeFileSync(googNodeBasePath, nodeBase, 'utf8');
  return require('./nodebase');
})();

coffeeForClosure = null;

lazyRequireCoffeeForClosure = function() {
  var _ref;
  if (coffeeForClosure) {
    return;
  }
  return _ref = require('./../este/dev/coffeeforclosure'), coffeeForClosure = _ref.coffeeForClosure, _ref;
};

options = {
  project: null,
  build: false,
  buildOptions: [],
  buildAll: false,
  debug: false,
  verbose: false,
  ci: false,
  only: '',
  port: 8000,
  errorBeep: false,
  locale: '',
  pythonBin: 'python'
};

socket = null;

startTime = Date.now();

booting = true;

watchOptions = {
  interval: 100
};

commandsRunning = false;

jsSubdirs = (function() {
  var path, _i, _len, _ref, _results;
  _ref = fs.readdirSync('assets/js');
  _results = [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    path = _ref[_i];
    if (!fs.statSync("assets/js/" + path).isDirectory()) {
      continue;
    }
    _results.push(path);
  }
  return _results;
})();

depsNamespaces = (function() {
  var dir, namespaces;
  namespaces = (function() {
    var _i, _len, _results;
    _results = [];
    for (_i = 0, _len = jsSubdirs.length; _i < _len; _i++) {
      dir = jsSubdirs[_i];
      _results.push("--root_with_prefix=\"assets/js/" + dir + " ../../../" + dir + "\" ");
    }
    return _results;
  })();
  return namespaces.join('');
})();

Commands = {
  projectTemplate: function(callback) {
    var file, filePath, scripts, timestamp;
    timestamp = Date.now().toString(36);
    if (options.build) {
      scripts = "<script src='/" + options.outputFilename + "?build=" + timestamp + "'></script>";
    } else {
      scripts = "<script src='/assets/js/dev/livereload.js'></script>\n<script src='/assets/js/google-closure/closure/goog/base.js'></script>\n<script src='/assets/js/deps.js'></script>\n<script src='/assets/js/" + options.project + "/start.js'></script>";
    }
    filePath = "./" + options.project + "-template.html";
    if (fs.existsSync(filePath)) {
      file = fs.readFileSync(filePath, 'utf8');
      file = file.replace(/###CLOSURESCRIPTS###/g, scripts);
      file = file.replace(/###BUILD_TIMESTAMP###/g, timestamp);
      fs.writeFileSync("./" + options.project + ".html", file, 'utf8');
    } else {
      console.log("" + filePath + " does not exits.");
    }
    return callback();
  },
  removeJavascripts: function(callback) {
    var jsPath, _i, _len, _ref;
    _ref = getPaths('assets/js', ['.js']);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      jsPath = _ref[_i];
      fs.unlinkSync(jsPath);
    }
    return callback();
  },
  coffeeScripts: "node assets/js/dev/node_modules/coffee-script/bin/coffee    --compile    --bare    --output assets/js assets/js",
  coffeeForClosure: function(callback, path) {
    var file, paths, _i, _len;
    lazyRequireCoffeeForClosure();
    if (path) {
      paths = [path];
    } else {
      paths = (function() {
        var _i, _len, _ref, _results;
        _ref = getPaths('assets/js', ['.js']);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          path = _ref[_i];
          _results.push(path);
        }
        return _results;
      })();
    }
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      if (path.indexOf('coffeeforclosure_test.js') === -1 && path.indexOf('coffeeforclosure.js') === -1 && fs.existsSync(path)) {
        file = fs.readFileSync(path, 'utf8');
        file = coffeeForClosure(file);
        fs.writeFileSync(path, file, 'utf8');
      }
    }
    return callback();
  },
  soyTemplates: function(callback) {
    var command, soyPaths;
    soyPaths = getPaths('assets/js', ['.soy']);
    if (!soyPaths.length) {
      callback();
      return;
    }
    command = getSoyCommand(soyPaths);
    return exec(command, callback);
  },
  closureDeps: "" + options.pythonBin + " assets/js/google-closure/closure/bin/build/depswriter.py    " + depsNamespaces + "    > assets/js/deps.js",
  closureCompilation: function(callback) {
    var flag, flags, flagsText, innerFn, _i, _j, _len, _len1, _ref, _ref1;
    if (fs.existsSync('assets/js-build')) {
      wrench.rmdirSyncRecursive('assets/js-build');
    }
    wrench.copyDirSyncRecursive('assets/js', 'assets/js-build', {
      preserveFiles: true
    });
    if (options.debug) {
      flags = '--formatting=PRETTY_PRINT --debug=true';
    } else {
      flags = '--define=goog.DEBUG=false';
    }
    flagsText = '';
    _ref = flags.split(' ');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      flag = _ref[_i];
      flagsText += "--compiler_flags=\"" + flag + "\" ";
    }
    _ref1 = options.buildOptions;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      flag = _ref1[_j];
      flagsText += "--compiler_flags=\"" + flag + "\" ";
    }
    innerFn = function() {
      var buildNamespaces, command, deps, jsPath, k, namespace, namespaces, source, startjs, v, _k, _l, _len2, _len3, _ref2;
      if (options.buildAll) {
        deps = tests.getDeps();
        namespaces = [];
        for (k in deps) {
          v = deps[k];
          if (k.indexOf("" + options.project + ".") !== 0) {
            continue;
          }
          if (k === ("" + options.project + ".start")) {
            continue;
          }
          namespaces.push(k);
        }
        startjs = ["goog.provide('" + options.project + ".start');"];
        for (_k = 0, _len2 = namespaces.length; _k < _len2; _k++) {
          namespace = namespaces[_k];
          startjs.push("goog.require('" + namespace + "');");
        }
        source = startjs.join('\n');
        fs.writeFileSync("./assets/js-build/" + options.project + "/start.js", source, 'utf8');
      }
      if (options.only) {
        startjs = ["goog.provide('" + options.project + ".start');"];
        startjs.push("goog.require('" + options.only + "');");
        source = startjs.join('\n');
        fs.writeFileSync("./assets/js/" + options.project + "/start.js", source, 'utf8');
      }
      if (!options.debug) {
        _ref2 = getPaths('assets/js-build', ['.js'], false, true);
        for (_l = 0, _len3 = _ref2.length; _l < _len3; _l++) {
          jsPath = _ref2[_l];
          source = fs.readFileSync(jsPath, 'utf8');
          if (source.indexOf('this.logger_.') === -1) {
            continue;
          }
          source = source.replace(/[^_](this\.logger_\.)/g, 'goog.DEBUG && this.logger_.').replace(/_this\.logger_\./g, 'goog.DEBUG && _this.logger_.');
          fs.writeFileSync(jsPath, source, 'utf8');
        }
      }
      buildNamespaces = (function() {
        var dir;
        namespaces = (function() {
          var _len4, _m, _results;
          _results = [];
          for (_m = 0, _len4 = jsSubdirs.length; _m < _len4; _m++) {
            dir = jsSubdirs[_m];
            _results.push("--root=assets/js-build/" + dir + " ");
          }
          return _results;
        })();
        return namespaces.join('');
      })();
      namespace = options.project.replace(/\//g, '.');
      command = "" + options.pythonBin + " assets/js/google-closure/closure/bin/build/closurebuilder.py        " + buildNamespaces + "        --namespace=\"" + namespace + ".start\"        --output_mode=compiled        --compiler_jar=assets/js/dev/compiler.jar        --compiler_flags=\"--compilation_level=ADVANCED_OPTIMIZATIONS\"        --compiler_flags=\"--warning_level=VERBOSE\"        --compiler_flags=\"--jscomp_warning=accessControls\"        --compiler_flags=\"--jscomp_warning=ambiguousFunctionDecl\"        --compiler_flags=\"--jscomp_warning=checkDebuggerStatement\"        --compiler_flags=\"--jscomp_warning=checkRegExp\"        --compiler_flags=\"--jscomp_warning=checkTypes\"        --compiler_flags=\"--jscomp_warning=checkVars\"        --compiler_flags=\"--jscomp_warning=const\"        --compiler_flags=\"--jscomp_warning=constantProperty\"        --compiler_flags=\"--jscomp_warning=deprecated\"        --compiler_flags=\"--jscomp_warning=duplicate\"        --compiler_flags=\"--jscomp_warning=externsValidation\"        --compiler_flags=\"--jscomp_warning=fileoverviewTags\"        --compiler_flags=\"--jscomp_warning=globalThis\"        --compiler_flags=\"--jscomp_warning=internetExplorerChecks\"        --compiler_flags=\"--jscomp_warning=invalidCasts\"        --compiler_flags=\"--jscomp_warning=missingProperties\"        --compiler_flags=\"--jscomp_warning=nonStandardJsDocs\"        --compiler_flags=\"--jscomp_warning=strictModuleDepCheck\"        --compiler_flags=\"--jscomp_warning=undefinedNames\"        --compiler_flags=\"--jscomp_warning=undefinedVars\"        --compiler_flags=\"--jscomp_warning=unknownDefines\"        --compiler_flags=\"--jscomp_warning=uselessCode\"        --compiler_flags=\"--jscomp_warning=visibility\"        --compiler_flags=\"--output_wrapper=(function(){%output%})();\"        --compiler_flags=\"--js=assets/js-build/deps.js\"        " + flagsText + "        > " + options.outputFilename;
      return exec(command, function() {
        wrench.rmdirSyncRecursive('assets/js-build');
        return callback.apply(null, arguments);
      });
    };
    if (options.locale) {
      flagsText += "--compiler_flags=\"--define=goog.LOCALE='" + options.locale + "'\" ";
      return insertMessages(innerFn);
    } else {
      return innerFn();
    }
  },
  mochaTests: tests.run,
  stylusStyles: function(callback) {
    var command, paths;
    paths = getPaths('assets', ['.styl']);
    command = "node assets/js/dev/node_modules/stylus/bin/stylus      --compress " + (paths.join(' '));
    return exec(command, callback);
  }
};

start = function(args) {
  if (!setOptions(args)) {
    return;
  }
  if (!options.build && !options.buildAll) {
    delete Commands.closureCompilation;
  }
  return runCommands(Commands, function(errors) {
    var commands, error, _i, _len;
    if (!options.ci) {
      startServer();
    }
    if (errors.length) {
      commands = ((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = errors.length; _i < _len; _i++) {
          error = errors[_i];
          _results.push(error.name);
        }
        return _results;
      })()).join(', ');
      console.log("Something's wrong with: " + commands + "\nFix it, then press cmd/ctrl-s.");
      for (_i = 0, _len = errors.length; _i < _len; _i++) {
        error = errors[_i];
        console.log(error.stderr);
      }
      if (options.ci) {
        process.exit(1);
      }
    } else {
      console.log("Everything's fine, happy coding.", "" + ((Date.now() - startTime) / 1000) + "s");
      if (options.ci) {
        process.exit(0);
      }
    }
    booting = false;
    if (!options.ci) {
      return watchPaths(onPathChange);
    }
  });
};

setOptions = function(args) {
  var arg, languages, outputFilename, path, _ref;
  while (args.length) {
    arg = args.shift();
    switch (arg) {
      case '--debug':
      case '-d':
        options.debug = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--build':
      case '-b':
        options.build = true;
        options.buildOptions = args.splice(0, args.length);
        break;
      case '--buildall':
      case '-ba':
        options.buildAll = true;
        break;
      case '--continuousintegration':
      case '-ci':
        options.ci = true;
        break;
      case '--only':
      case '-o':
        options.only = args.shift();
        break;
      case '--port':
      case '-p':
        options.port = args.shift();
        break;
      case '--errorbeep':
      case '-eb':
        options.errorBeep = true;
        break;
      case '--python':
      case '-pb':
        options.pythonBin = args.shift();
        break;
      case '--extractmessages':
      case '-em':
        languages = args.splice(0, args.length);
        extractMessages(languages);
        return false;
      case '--help':
      case '-h':
        console.log("\nOptions:\n  --build, -b\n    Compile everything, run tests, build project.\n    Update [project].html to use just one compiled script.\n    Set goog.DEBUG flag to false.\n    Start watching all source files, recompile them on change.\n\n    Example how to set compiler_flags:\n      node run app -b\n        --define=goog.DEBUG=true\n        --define=goog.LOCALE=\'cs\'\n\n    Example how to use localization:\n      node run app -b en\n        set goog.LOCALE to 'en'\n        insert messages from assets/messages/[project]/[LOCALE].json\n        compile to assets/js/[project]_[en].js\n\n    Example how to compile one namespace\n      node run este/demos/app/todomvc -b\n\n  --debug, -d\n    Same as build, but with these compiler flags:\n      '--formatting=PRETTY_PRINT --debug=true'\n    Set goog.DEBUG flag to false.\n    Compiler output will be much readable.\n\n    Example:\n      node run app -d -b (note that -d is before -b)\n\n  --verbose, -v\n    To show some time stats.\n\n  --continuousintegration, -ci\n    Continuous integration mode. Without http server and files watchers.\n\n  --port, -p\n    To override default http://localhost:8000/ port.\n\n  --buildall, -ba\n    Build and statically check all namespaces in project. Useful for\n    debugging, after closure update, etc.\n\n  --errorbeep, -eb\n    Friendly beep on error.\n\n  --extractmessages, -em\n    Extract messages from source code and generate dictionaries in\n    assets/messages/project directory. Messages are defined with\n    goog.getMsg method.\n\n    Example\n      node run app -em en de\n\n  --python, -pb\n    Setup python binary. To override default 'python'.\n\n  --help, -h\n    To show this help.\n");
        return false;
      default:
        options.project = arg;
    }
  }
  path = "assets/js/" + options.project;
  if (!fs.existsSync(path)) {
    console.log("Project directory " + path + " does not exists.");
  }
  if (((_ref = options.buildOptions[0]) != null ? _ref.indexOf('--') : void 0) !== 0) {
    options.locale = options.buildOptions[0];
    options.buildOptions.shift();
  }
  outputFilename = "assets/js/" + options.project;
  if (options.locale) {
    outputFilename += "_" + options.locale;
  }
  if (options.debug) {
    outputFilename += '_dev.js';
  } else {
    outputFilename += '.js';
  }
  options.outputFilename = outputFilename;
  if (options.build) {
    console.log('Output filename: ' + options.outputFilename);
  }
  return true;
};

startServer = function() {
  var server, wsServer;
  server = http.createServer(function(request, response) {
    var contentType, extname, filePath, stats;
    filePath = '.' + request.url;
    if (filePath === './') {
      filePath = "./" + options.project + ".html";
    }
    if (filePath.indexOf('?') !== -1) {
      filePath = filePath.split('?')[0];
    }
    if (fs.existsSync(filePath)) {
      stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        filePath = pathModule.join(filePath, 'index.html');
      }
    }
    extname = pathModule.extname(filePath);
    switch (extname) {
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      default:
        contentType = 'text/html';
    }
    fs.exists(filePath, function(exists) {
      if (!exists) {
        response.writeHead(404);
        response.end('404', 'utf-8');
        return;
      }
      return fs.readFile(filePath, function(error, content) {
        if (error) {
          response.writeHead(500);
          response.end('500', 'utf-8');
          return;
        }
        response.writeHead(200, {
          'Content-Type': contentType
        });
        return response.end(content, 'utf-8');
      });
    });
  });
  wsServer = ws.attach(server);
  wsServer.on('connection', function(p_socket) {
    return socket = p_socket;
  });
  server.listen(options.port);
  return console.log("Server is listening on http://localhost:" + options.port + "/");
};

getPaths = function(directory, extensions, includeDirs, enforceClosure) {
  var file, files, path, paths, _i, _len, _ref;
  paths = [];
  files = fs.readdirSync(directory);
  for (_i = 0, _len = files.length; _i < _len; _i++) {
    file = files[_i];
    path = directory + '/' + file;
    if (!enforceClosure && path.indexOf('google-closure/') > -1) {
      continue;
    }
    if (path.indexOf('assets/js/dev') > -1) {
      continue;
    }
    if (fs.statSync(path).isDirectory()) {
      if (includeDirs) {
        paths.push(path);
      }
      paths.push.apply(paths, getPaths(path, extensions, includeDirs, enforceClosure));
    } else {
      if (_ref = pathModule.extname(path), __indexOf.call(extensions, _ref) >= 0) {
        paths.push(path);
      }
    }
  }
  return paths;
};

getSoyCommand = function(paths) {
  return "java -jar assets/js/dev/SoyToJsSrcCompiler.jar    --shouldProvideRequireSoyNamespaces    --shouldGenerateGoogMsgDefs    --bidiGlobalDir 1    --shouldGenerateJsdoc    --codeStyle concat    --outputPathFormat {INPUT_DIRECTORY}/{INPUT_FILE_NAME_NO_EXT}.js    " + (paths.join(' '));
};

watchPaths = function(callback) {
  var path, paths, stylusStyles, _fn, _i, _len;
  paths = getPaths('assets/js', ['.coffee', '.ts', '.styl', '.soy', '.html'], true);
  stylusStyles = getPaths('assets/css', ['.styl'], true);
  paths.push.apply(paths, stylusStyles);
  paths.push("" + options.project + "-template.html");
  paths.push('assets/js/dev/livereload.coffee');
  paths.push('assets/js/dev/mocks.coffee');
  paths.push('assets/js/dev/run.coffee');
  paths.push('assets/js/dev/tests.coffee');
  _fn = function(path) {
    if (path.indexOf('.') > -1) {
      return fs.watchFile(path, watchOptions, function(curr, prev) {
        if (curr.mtime > prev.mtime) {
          return callback(path, false);
        }
      });
    } else {
      return fs.watch(path, watchOptions, function() {
        return callback(path, true);
      });
    }
  };
  for (_i = 0, _len = paths.length; _i < _len; _i++) {
    path = paths[_i];
    if (watchPaths['$' + path]) {
      continue;
    }
    watchPaths['$' + path] = true;
    _fn(path);
  }
};

onPathChange = function(path, dir) {
  var addBrowserLiveReloadCommand, commands;
  if (dir) {
    watchPaths(onPathChange);
    return;
  }
  commands = {};
  addBrowserLiveReloadCommand = function(action) {
    return commands["reload browser"] = function(callback) {
      notifyClient(action);
      return callback();
    };
  };
  switch (pathModule.extname(path)) {
    case '.html':
      if (path === ("" + options.project + "-template.html")) {
        commands['projectTemplate'] = Commands.projectTemplate;
      }
      addBrowserLiveReloadCommand('page');
      break;
    case '.coffee':
      commands["coffeeScript: " + path] = "        node assets/js/dev/node_modules/coffee-script/bin/coffee          --compile --bare " + path;
      commands["coffeeForClosure"] = function(callback) {
        return Commands.coffeeForClosure(callback, path.replace('.coffee', '.js'));
      };
      commands["closureDeps"] = Commands.closureDeps;
      commands["mochaTests"] = Commands.mochaTests;
      if (options.build || options.buildAll) {
        commands["closureCompilation"] = Commands.closureCompilation;
      } else {
        addBrowserLiveReloadCommand('page');
      }
      break;
    case '.styl':
      commands["stylusStyle: " + path] = "        node assets/js/dev/node_modules/stylus/bin/stylus          --compress " + path;
      addBrowserLiveReloadCommand('styles');
      break;
    case '.soy':
      commands["soyTemplate: " + path] = getSoyCommand([path]);
      commands["closureDeps"] = Commands.closureDeps;
      if (options.build || options.buildAll) {
        commands["closureCompilation"] = Commands.closureCompilation;
      }
      addBrowserLiveReloadCommand('page');
      break;
    default:
      return;
  }
  clearScreen();
  if (commandsRunning) {
    return;
  }
  return runCommands(commands);
};

clearScreen = function() {
  process.stdout.write('\033[2J');
  return process.stdout.write('\033[1;3H');
};

runCommands = function(commands, complete, errors) {
  var command, commandStartTime, k, name, nextCommands, onExec, v;
  if (errors == null) {
    errors = [];
  }
  commandsRunning = true;
  for (name in commands) {
    command = commands[name];
    break;
  }
  if (!command) {
    commandsRunning = false;
    if (options.verbose && !booting) {
      console.log('ready');
    }
    if (complete) {
      complete(errors);
    }
    return;
  }
  if (name === 'closureCompilation') {
    console.log('Compiling, please wait...');
  }
  commandStartTime = Date.now();
  nextCommands = {};
  for (k in commands) {
    v = commands[k];
    if (k !== name) {
      nextCommands[k] = v;
    }
  }
  onExec = function(err, stdout, stderr) {
    var isError, output;
    if (name === 'closureCompilation') {
      console.log('Compilation finished.');
    }
    isError = !!err || stderr;
    if (name === 'closureCompilation') {
      isError = isClosureCompilationError(stderr);
    }
    if (isError) {
      output = stderr;
      if (name === 'mochaTests') {
        stdout = stdout.trim();
        stdout = stdout.replace('\033[2J', '');

        stdout = stdout.replace('\033[1;3H', '');

        output = stderr + stdout;
      }
      if (booting) {
        errors.push({
          name: name,
          command: command,
          stderr: output
        });
      } else {
        if (options.errorBeep) {
          console.log(output + '\x07');
        } else {
          console.log(output);
        }
        nextCommands = {};
      }
    }
    if (booting || options.verbose) {
      console.log(name + (" in " + ((Date.now() - commandStartTime) / 1000) + "s"));
    }
    return runCommands(nextCommands, complete, errors);
  };
  if (typeof command === 'function') {
    command(onExec);
  } else {
    exec(command, onExec);
  }
};

notifyClient = function(message) {
  if (!socket) {
    return;
  }
  return socket.send(message);
};

extractMessages = function(languages) {
  var language, languagePath, messagesPath, projectPath, _i, _len;
  messagesPath = 'assets/messages';
  if (!fs.existsSync(messagesPath)) {
    fs.mkdir(messagesPath);
  }
  projectPath = "" + messagesPath + "/" + options.project;
  if (!fs.existsSync(projectPath)) {
    fs.mkdir(projectPath);
  }
  for (_i = 0, _len = languages.length; _i < _len; _i++) {
    language = languages[_i];
    languagePath = "" + projectPath + "/" + language + ".json";
    if (!fs.existsSync(languagePath)) {
      fs.writeFileSync(languagePath, '{}', 'utf8');
    }
  }
  return getProjectPaths('js', function(scripts) {
    var description, dictionary, i, json, jsonMessage, message, script, source, syntax, text, token, tokens, translation, translations, _j, _k, _l, _len1, _len2, _len3, _ref, _ref1;
    dictionary = {};
    for (_j = 0, _len1 = scripts.length; _j < _len1; _j++) {
      script = scripts[_j];
      source = fs.readFileSync(script, 'utf8');
      if (source.indexOf('goog.getMsg') === -1) {
        continue;
      }
      syntax = esprima.parse(source, {
        comment: true,
        range: true,
        tokens: true
      });
      tokens = syntax.tokens.concat(syntax.comments);
      sortTokens(tokens);
      for (i = _k = 0, _len2 = tokens.length; _k < _len2; i = ++_k) {
        token = tokens[i];
        if (token.type !== "Identifier" || token.value !== 'getMsg') {
          continue;
        }
        message = getMessage(tokens, i);
        if (!message) {
          continue;
        }
        description = getMessageDescription(tokens, i);
        if (!description) {
          continue;
        }
        if ((_ref = dictionary[message]) == null) {
          dictionary[message] = {};
        }
        dictionary[message][description] = 'to translate: ' + message;
      }
    }
    /*
          Merge new dictionary into yet existing dictionaries. This is especially
          usefull for as you go localization.
    */

    for (_l = 0, _len3 = languages.length; _l < _len3; _l++) {
      language = languages[_l];
      languagePath = "" + projectPath + "/" + language + ".json";
      source = fs.readFileSync(languagePath, 'utf8');
      json = JSON.parse(source);
      for (message in dictionary) {
        translations = dictionary[message];
        jsonMessage = (_ref1 = json[message]) != null ? _ref1 : json[message] = {};
        for (description in translations) {
          translation = translations[description];
          if (jsonMessage[description]) {
            continue;
          }
          jsonMessage[description] = translation;
        }
      }
      text = JSON.stringify(json, null, 2);
      fs.writeFileSync(languagePath, text, 'utf8');
    }
  });
};

sortTokens = function(tokens) {
  return tokens.sort(function(a, b) {
    if (a.range[0] > b.range[0]) {
      return 1;
    } else if (a.range[0] < b.range[0]) {
      return -1;
    } else {
      return 0;
    }
  });
};

getMessage = function(tokens, i) {
  if (tokens[i + 1].type === 'Punctuator' && tokens[i + 1].value === '(' && tokens[i + 2].type === 'String') {
    return tokens[i + 2].value.slice(1, -1);
  }
  return '';
};

getMessageDescription = function(tokens, i) {
  var description, token, _ref;
  while (true) {
    token = tokens[--i];
    if (!token) {
      return '';
    }
    if (!((_ref = token.type) === 'Identifier' || _ref === 'Punctuator')) {
      break;
    }
  }
  if (token.type === 'Keyword' && token.value === 'var') {
    token = tokens[--i];
  }
  if (token.type !== 'Block') {
    return '';
  }
  description = token.value.split('@desc')[1];
  if (!description) {
    return '';
  }
  return description.trim();
};

insertMessages = function(callback) {
  var dictionaryPath;
  dictionaryPath = "assets/messages/" + options.project + "/" + options.locale + ".json";
  if (!fs.existsSync(dictionaryPath)) {
    console.log("Missing dictionary: " + dictionaryPath);
    callback();
    return;
  }
  return getProjectPaths('js-build', function(scripts) {
    var description, dictionary, i, localizedSource, message, next, range, replacement, replacements, script, source, syntax, token, tokens, translatedMsg, _i, _j, _k, _len, _len1, _len2, _ref;
    source = fs.readFileSync(dictionaryPath, 'utf8');
    dictionary = JSON.parse(source);
    for (_i = 0, _len = scripts.length; _i < _len; _i++) {
      script = scripts[_i];
      source = fs.readFileSync(script, 'utf8');
      if (source.indexOf('goog.getMsg') === -1) {
        continue;
      }
      syntax = esprima.parse(source, {
        comment: true,
        range: true,
        tokens: true
      });
      tokens = syntax.tokens.concat(syntax.comments);
      sortTokens(tokens);
      replacements = [];
      for (i = _j = 0, _len1 = tokens.length; _j < _len1; i = ++_j) {
        token = tokens[i];
        if (token.type !== "Identifier" || token.value !== 'getMsg') {
          continue;
        }
        message = getMessage(tokens, i);
        if (!message) {
          continue;
        }
        description = getMessageDescription(tokens, i);
        if (!description) {
          continue;
        }
        translatedMsg = (_ref = dictionary[message]) != null ? _ref[description] : void 0;
        if (!translatedMsg) {
          continue;
        }
        range = tokens[i + 2].range;
        range[0]++;
        range[1]--;
        replacements.push({
          start: range[0],
          end: range[1],
          msg: translatedMsg
        });
      }
      localizedSource = '';
      for (i = _k = 0, _len2 = replacements.length; _k < _len2; i = ++_k) {
        replacement = replacements[i];
        if (i === 0) {
          localizedSource += source.slice(0, replacement.start);
        }
        localizedSource += replacement.msg;
        next = replacements[i + 1];
        if (next) {
          localizedSource += source.slice(replacement.end, next.start);
        } else {
          localizedSource += source.slice(replacement.end);
        }
      }
      localizedSource || (localizedSource = source);
      fs.writeFileSync(script, localizedSource, 'utf8');
    }
    return callback();
  });
};

getProjectPaths = function(jsDir, callback) {
  var command, jsNamespaces;
  jsNamespaces = (function() {
    var dir, namespaces;
    namespaces = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = jsSubdirs.length; _i < _len; _i++) {
        dir = jsSubdirs[_i];
        _results.push("--root=assets/" + jsDir + "/" + dir + " ");
      }
      return _results;
    })();
    return namespaces.join('');
  })();
  command = "" + options.pythonBin + " assets/js/google-closure/closure/bin/build/closurebuilder.py    " + jsNamespaces + "    --namespace=\"" + options.project + ".start\"    --output_mode=list    --compiler_jar=assets/js/dev/compiler.jar    --compiler_flags=\"--js=assets/" + jsDir + "/deps.js\"";
  return exec(command, function(err, stdout, stderr) {
    var script, scripts, _i, _len, _ref;
    if (isClosureCompilationError(stderr)) {
      console.log(stderr);
      return;
    }
    scripts = [];
    _ref = stdout.split('\n');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      script = _ref[_i];
      script = script.trim();
      if (script) {
        scripts.push(script);
      }
    }
    return callback(scripts);
  });
};

isClosureCompilationError = function(stderr) {
  return ~(stderr != null ? stderr.indexOf(': WARNING - ') : void 0) || ~(stderr != null ? stderr.indexOf(': ERROR - ') : void 0) || ~(stderr != null ? stderr.indexOf('JavaScript compilation failed.') : void 0) || ~(stderr != null ? stderr.indexOf('Traceback (most recent call last):') : void 0);
};

exports.start = start;
