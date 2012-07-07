// Generated by CoffeeScript 1.3.3
/**
  @fileoverview https://github.com/Steida/este.

  Features
    compile and watch CoffeeScript, Stylus, Soy, [project]-template.html
    update Google Closure deps.js
    run and watch [*]_test.coffee unit tests
    run simple NodeJS development server

  Workflow
    'node run app'
      to start app development
    
    'node run app --deploy'
      build scripts with closure compiler
      [project].html will use one compiled script
      goog.DEBUG == false (code using that will be stripped)

    'node run app --deploy --debug'
      compiler flags: '--formatting=PRETTY_PRINT --debug=true'
      goog.DEBUG == true

    'node run app --verbose'
      if you are curious how much time each compilation took

    'node run app --buildonly'
      only builds the files aka CI mode
      does not start http server nor watches for changes

  Todo
    fix too much cmd-s's errors
    consider: delete .css onstart
    strip asserts and strings throws
*/

var Commands, addDepsAndCompilation, booting, buildNamespaces, clearScreen, depsNamespaces, exec, fs, getPaths, getSoyCommand, http, jsSubdirs, notifyClient, onPathChange, options, pathModule, runCommands, setOptions, socket, start, startServer, startTime, tests, watchOptions, watchPaths, ws,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

fs = require('fs');

exec = require('child_process').exec;

tests = require('./tests');

http = require('http');

pathModule = require('path');

ws = require('websocket.io');

options = {
  project: null,
  verbose: false,
  debug: false,
  deploy: false,
  buildonly: false
};

socket = null;

startTime = Date.now();

booting = true;

watchOptions = {
  interval: 100
};

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

buildNamespaces = (function() {
  var dir, namespaces;
  namespaces = (function() {
    var _i, _len, _results;
    _results = [];
    for (_i = 0, _len = jsSubdirs.length; _i < _len; _i++) {
      dir = jsSubdirs[_i];
      _results.push("--root=assets/js/" + dir + " ");
    }
    return _results;
  })();
  return namespaces.join('');
})();

/**
  Commands for watchables.
*/


Commands = {
  projectTemplate: function(callback) {
    var file, scripts, timestamp;
    try {
      timestamp = Date.now().toString(36);
      if (options.deploy) {
        scripts = "<script src='/" + options.outputFilename + "?build=" + timestamp + "'></script>";
      } else {
        scripts = "<script src='/assets/js/dev/livereload.js'></script>\n<script src='/assets/js/google-closure/closure/goog/base.js'></script>\n<script src='/assets/js/deps.js'></script>\n<script src='/assets/js/" + options.project + "/start.js'></script>";
      }
      file = fs.readFileSync("./" + options.project + "-template.html", 'utf8');
      file = file.replace(/###CLOSURESCRIPTS###/g, scripts);
      file = file.replace(/###BUILD_TIMESTAMP###/g, timestamp);
      return fs.writeFileSync("./" + options.project + ".html", file, 'utf8');
    } catch (e) {
      return callback(true, null, e.toString);
    } finally {
      callback();
    }
  },
  removeJavascripts: function(callback) {
    var jsPath, _i, _len, _ref;
    _ref = getPaths('assets', ['.js']);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      jsPath = _ref[_i];
      fs.unlinkSync(jsPath);
    }
    return callback();
  },
  coffeeScripts: "coffee --compile --bare --output assets/js assets/js",
  soyTemplates: function(callback) {
    var command, soyPaths;
    soyPaths = getPaths('assets', ['.soy']);
    command = getSoyCommand(soyPaths);
    return exec(command, callback);
  },
  closureDeps: "python assets/js/google-closure/closure/bin/build/depswriter.py    " + depsNamespaces + "    > assets/js/deps.js",
  closureCompilation: function(callback) {
    var command, flag, flags, flagsText, jsPath, preservedClosureScripts, source, _i, _j, _len, _len1, _ref, _ref1;
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
    preservedClosureScripts = [];
    if (!options.debug) {
      _ref1 = getPaths('assets', ['.js'], false, true);
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        jsPath = _ref1[_j];
        source = fs.readFileSync(jsPath, 'utf8');
        if (source.indexOf('this.logger_.') === -1) {
          continue;
        }
        if (jsPath.indexOf('google-closure/') !== -1) {
          preservedClosureScripts.push({
            jsPath: jsPath,
            source: source
          });
        }
        source = source.replace(/[^_](this\.logger_\.)/g, 'goog.DEBUG && this.logger_.');
        source = source.replace(/_this\.logger_\./g, 'goog.DEBUG && _this.logger_.');
        fs.writeFileSync(jsPath, source, 'utf8');
      }
    }
    command = "python assets/js/google-closure/closure/bin/build/closurebuilder.py      " + buildNamespaces + "      --namespace=\"" + options.project + ".start\"      --output_mode=compiled      --compiler_jar=assets/js/dev/compiler.jar      --compiler_flags=\"--compilation_level=ADVANCED_OPTIMIZATIONS\"      --compiler_flags=\"--jscomp_warning=visibility\"      --compiler_flags=\"--warning_level=VERBOSE\"      --compiler_flags=\"--output_wrapper=(function(){%output%})();\"      --compiler_flags=\"--js=assets/js/deps.js\"      " + flagsText + "      > " + options.outputFilename;
    return exec(command, function() {
      var script, _k, _len2;
      for (_k = 0, _len2 = preservedClosureScripts.length; _k < _len2; _k++) {
        script = preservedClosureScripts[_k];
        fs.writeFileSync(script.jsPath, script.source, 'utf8');
      }
      return callback.apply(null, arguments);
    });
  },
  mochaTests: tests.run,
  stylusStyles: function(callback) {
    var command, paths;
    paths = getPaths('assets', ['.styl']);
    command = "stylus --compress " + (paths.join(' '));
    return exec(command, callback);
  }
};

start = function(args) {
  if (!setOptions(args)) {
    return;
  }
  if (!options.deploy) {
    delete Commands.closureCompilation;
  }
  return runCommands(Commands, function(errors) {
    var commands, error, _i, _len;
    if (!options.buildonly) {
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
      console.log("Something's wrong with: " + commands + "\nFixit, then press cmd-s.");
      for (_i = 0, _len = errors.length; _i < _len; _i++) {
        error = errors[_i];
        console.log(error.stderr);
      }
      if (options.buildonly) {
        process.exit(1);
      }
    } else {
      console.log("Everything's fine, happy coding!", "" + ((Date.now() - startTime) / 1000) + "s");
      if (options.buildonly) {
        process.exit(0);
      }
    }
    booting = false;
    if (!options.buildonly) {
      return watchPaths(onPathChange);
    }
  });
};

setOptions = function(args) {
  var arg, path;
  while (args.length) {
    arg = args.shift();
    switch (arg) {
      case '--debug':
        options.debug = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--deploy':
        options.deploy = true;
        break;
      case '--buildonly':
        options.buildonly = true;
        break;
      default:
        options.project = arg;
    }
  }
  path = "assets/js/" + options.project;
  if (!fs.existsSync(path)) {
    console.log("Project directory " + path + " does not exists.");
    return false;
  }
  if (options.debug) {
    options.outputFilename = "assets/js/" + options.project + "_dev.js";
  } else {
    options.outputFilename = "assets/js/" + options.project + ".js";
  }
  if (options.deploy) {
    console.log('Output filename: ' + options.outputFilename);
  }
  return true;
};

startServer = function() {
  var server, wsServer;
  server = http.createServer(function(request, response) {
    var contentType, extname, filePath;
    filePath = '.' + request.url;
    if (filePath === './') {
      filePath = "./" + options.project + ".htm";
    }
    if (filePath.indexOf('?') !== -1) {
      filePath = filePath.split('?')[0];
    }
    extname = pathModule.extname(filePath);
    contentType = 'text/html';
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
    }
    fs.exists(filePath, function(exists) {
      if (!exists) {
        filePath = "./" + options.project + ".html";
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
  server.listen(8000);
  return console.log('Server is listening on http://localhost:8000/');
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
  return "java -jar assets/js/dev/SoyToJsSrcCompiler.jar    --shouldProvideRequireSoyNamespaces    --shouldGenerateJsdoc    --codeStyle concat    --outputPathFormat {INPUT_DIRECTORY}/{INPUT_FILE_NAME_NO_EXT}.js    " + (paths.join(' '));
};

watchPaths = function(callback) {
  var path, paths, _fn, _i, _len;
  paths = getPaths('assets', ['.coffee', '.styl', '.soy'], true);
  paths.push("" + options.project + "-template.html");
  paths.push('assets/js/dev/run.coffee');
  paths.push('assets/js/dev/mocks.coffee');
  paths.push('assets/js/dev/deploy.coffee');
  paths.push('assets/js/dev/tests.coffee');
  paths.push('assets/js/dev/livereload.coffee');
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
  var commands, notifyAction;
  if (dir) {
    watchPaths(onPathChange);
    return;
  }
  commands = {};
  notifyAction = 'page';
  switch (pathModule.extname(path)) {
    case '.html':
      if (path === ("" + options.project + "-template.html")) {
        commands['projectTemplate'] = Commands.projectTemplate;
      }
      break;
    case '.coffee':
      commands["coffeeScript: " + path] = "coffee --compile --bare " + path;
      commands["mochaTests"] = Commands.mochaTests;
      addDepsAndCompilation(commands);
      break;
    case '.styl':
      commands["stylusStyle: " + path] = "stylus --compress " + path;
      break;
    case '.soy':
      commands["soyTemplate: " + path] = getSoyCommand([path]);
      addDepsAndCompilation(commands);
      break;
    default:
      return;
  }
  clearScreen();
  return runCommands(commands, function() {
    return notifyClient(notifyAction);
  });
};

clearScreen = function() {
  process.stdout.write('\033[2J');
  return process.stdout.write('\033[1;3H');
};

addDepsAndCompilation = function(commands) {
  commands["closureDeps"] = Commands.closureDeps;
  if (!options.deploy) {
    return;
  }
  return commands["closureCompilation"] = Commands.closureCompilation;
};

runCommands = function(commands, complete, errors) {
  var command, commandStartTime, k, name, nextCommands, onExec, v;
  if (errors == null) {
    errors = [];
  }
  for (name in commands) {
    command = commands[name];
    break;
  }
  if (!command) {
    if (complete) {
      complete(errors);
    }
    return;
  }
  if (name === 'closureCompilation') {
    console.log('Compiling scripts, wait pls...');
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
    var isError;
    if (name === 'closureCompilation') {
      console.log('done');
    }
    isError = !!err;
    if (!isError && name === 'closureCompilation' && ~(stderr != null ? stderr.indexOf(': WARNING -') : void 0)) {
      isError = true;
    }
    if (isError) {
      if (booting) {
        errors.push({
          name: name,
          command: command,
          stderr: stderr
        });
      } else {
        console.log(stderr);
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

exports.start = start;
