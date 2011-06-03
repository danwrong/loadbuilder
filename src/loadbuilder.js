var fs     = require('fs'),
    sys    = require('sys'),
    mkdir  = require('./util/mkdirSync'),
    jsp    = require('uglify-js').parser,
    jspro  = require("uglify-js").uglify,
    opts   = require('opts'),
    colors = require('colors'),
    path   = require('path'),
    jshint = require('jshint').JSHINT;

function mixin(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function indent(depth) {
  return Array(depth).join(' ');
}

function extractDeps(argList) {
  var depList = [];
  argList.forEach(function(item) {
    if (item[0] == 'string') depList.push(item[1]);
    else if (item[0] == 'array') depList = depList.concat(extractDeps(item[1]));
  });
  return depList;
}

function isUsing(node) {
  return node[0] == 'call' && node[1] && node[1][1] == 'using';
}

function isProvide(node) {
  return node[0] == 'call' && node[1] && node[1][1] == 'provide';
}

function excluded(item, loadbuilder) {
  var excluded = false;
  loadbuilder.options.exclude.forEach(function(excl) {
    if (typeof(excl)=='string' && excl==item) {
      excluded = true;
      return;
    }
    if (typeof(excl)=='object') {
      excl.forEach(function(exclitem) {
        if (exclitem == item) {
          excluded = true;
          return;
        }
      });
    }
  });
  return excluded;
}


function Dependency() {
  // this.name => the string appearing in the using statement
  // this.lb => a reference to the builder object we're using
}

function DependencyChain() {
  this.deps = [];
}
DependencyChain.prototype.add = function(dep) {
 // remove from dependencies if existing
 this.deps = this.deps.filter(function(element) {
   return (element.name != dep.name);
 });
 // add above first script
 this.deps.unshift(dep);
}

function Script(name, loadbuilder) {
  if (name) {
    this.name = name;
    this.lb = loadbuilder;
    this.filename = this.getFilename(this.lb.options.modPath);
    this.license = '';
    this.preCode = 'provide("' + name + '", function(exports) {';
    this.postCode = ';exports();loadrunner.Script.loaded.push("' + name + '")})';
    this.type = 'script';
  }
}
Script.matcher = /\.js$/;
Script.prototype = new Dependency;
Script.prototype.fetchSource = function() {
  return fs.readFileSync(this.lb.options.docRoot + this.filename, 'utf8');
};
Script.prototype.parseSource = function(source) {
  this.license = this.getLicense(source);
  return jsp.parse(source);
};
Script.prototype.getLicense = function(source) {
  var text = source.replace(/\n/g, '\\n');
  var matches = text.match(/^(\/\*\!.*?\*\/)/);
  if (matches) return matches[1].replace(/\\n/g, '\n');
  return '';
};
Script.prototype.hint = function(source, opts) {
  jshint(source, opts);
  if (jshint.errors.length) {
    this.lb.logInfo('JSHint ' + this.name, jshint.errors);
  }
};
Script.prototype.getCode = function(parsedSource, minify) {
  var code, ast = parsedSource;
  if (minify) {
    ast = jspro.ast_mangle(ast);
    ast = jspro.ast_squeeze(ast);
  }
  code = jspro.gen_code(ast);
  return this.preCode + this.license + code + this.postCode;
};
Script.prototype.getFilename = function(modPath) {
  return this.name.replace(/^\$/, modPath);
};
Script.prototype.traceDependencies = function(depth) {
  var me = this, source, parsedSource;
  depth = depth+1 || 0;
  if (excluded(this.name, this.lb)) {
    this.lb.logInfo('Ignoring file:', [ this.name, this.filename ]);
    return;
  }
  try {
    source = this.fetchSource();
    this.lb.logInfo('Loading file:', [ this.name, this.filename ]);
  } catch (error) {
    this.lb.logError('Failed to load file:', [ this.name, this.filename ]);
    return;
  }
  try {
    parsedSource = this.parseSource(source);
    this.lb.dependencies.add(this);
  } catch (error) {
    this.lb.logError('Failed to parse file:', [ this.name, this.filename ]);
    this.hint(source);
    return;
  }

  function walk(node) {
    if (Array.isArray(node)) {
      if (isUsing(node)) {
        var deps = extractDeps(node[2]);
        deps.forEach(function(d) {
          me.lb._loadFile(d, depth+1);
        });
      } else if (isProvide(node)) {
        if (node[2][0][0] === 'function') {
          node[2].unshift(['string', me.name]);
        }
      }

      node.forEach(walk);
    }
  }

  walk(parsedSource);

  this.code = this.getCode(parsedSource, !this.lb.options.nomin);

  return;
};


function Module(name, loadbuilder) {
  this.name = name;
  this.lb = loadbuilder;
  this.filename = this.lb.options.modPath + this.getFilename();
  this.license = '';
  this.preCode = '';
  this.postCode = '';
  this.type = 'module';
}
Module.matcher = /^[a-zA-Z0-9_\-\/]+$/;
Module.prototype = new Script;
Module.prototype.getFilename = function() {
  return this.name + '.js';
};

function LoadBuilder(options) {
  this.options = {
    exclude: [],
    docRoot: process.cwd(),
    distRoot: 'STDOUT/',
    modPath: '/modules',
    logLevel: 1,  // log levels: 0:none, 1:error, 2:info
    matchers: [Script, Module],
    nomin: false
  };
  this.manifest = {};
  this.clean();
  this.config(options);
}
LoadBuilder.prototype = {
  // Removes data pertaining to current bundling task, but not the overall builder, like manifests and config.
  clean: function() {
    this.options.exclude = [];
    this.dependencies = new DependencyChain;
    this.code = '';
    this.errors = [];
  },
  // Applies new config options
  config: function(options) {
    mixin(this.options, options);
    this.options.docRoot = this.options.docRoot.replace(/\/$/,'') + '/';
    this.options.distRoot = this.options.distRoot.replace(/\/$/,'') + '/';
    this.options.modPath = this.options.modPath.replace(/^\//,'').replace(/\/$/,'') + '/';
    if (this.options.docRoot == this.options.distRoot) {
      this.logInfo('Helpfully appending "dist" to the distRoot.', []);
      this.options.distRoot += 'dist/';
    }
    return this;
  },
  // Works out the type of a given dependency
  // Then loads the file
  _loadFile: function(name, depth) {
    for (var index in this.options.matchers) {
      if (name.match(this.options.matchers[index].matcher)) {
        var file = new this.options.matchers[index](name, this);
        file.traceDependencies(depth);
        return;
      }
    }
    this.logError('Unrecognised dependency', [ name ]);
  },
  // This is used to load the initial files/modules provided to the builder
  load: function(files, options) {
    var file, loadbuilder=this;
    if (typeof(files)==="string") files=[files];
    files.forEach(function(d) {
      loadbuilder._loadFile(d, 0);
    });
    return this;
  },
  // Use JSHINT on all the dependencies in the bundle
  hint: function(opts){
    this.dependencies.deps.forEach(function(d) {
      d.hint(opts);
    });
  },
  // Wrap our code string with a custom namespace
  namespace: function(code) {
    return this.options.namespace + "(function(using, provide, loadrunner, define) {" +
                code + '});';
  },
  // Add a minified version of loadrunner to the top of the code string
  addLoadrunner: function(code) {
    var lr = fs.readFileSync(this.options.standAlone, 'utf8');

    if (!this.options.nomin) {
      var ast = jsp.parse(lr);
          ast = jspro.ast_mangle(ast);
          ast = jspro.ast_squeeze(ast);

      lr = jspro.gen_code(ast);
    }

    if (typeof this.options.namespace == 'string' && this.options.namespace.length > 0) {
      lr += ";window." + this.options.namespace + " = loadrunner.noConflict();"
    }

    return lr + code;
  },
  // Generate the code string, apply options and output to a file or stdout
  save: function(outputFilename) {
    // merge code
    var codeArr = [], code;
    this.dependencies.deps.forEach(function(item) {
      codeArr.push(item.code);
    });
    code = codeArr.join(";\n");

    if (typeof this.options.namespace == 'string' && this.options.namespace.length > 0) {
      code = this.namespace(code);
    }

    if (typeof this.options.standAlone == 'string' && this.options.standAlone.length > 0) {
      code = this.addLoadrunner(code);
    }

    var outputFile = this.options.distRoot + outputFilename;

    if (this.options.distRoot == 'STDOUT/') {
      console.log(code);
    } else {
      this.logInfo('Output file', [ outputFile ]);
      mkdir(outputFile.replace(/[^\/]+$/, ''));
      fs.writeFileSync(outputFile, code);
    }
    return this;
  },
  // Bundle a module
  bundle: function(name, bundleOpts) {
    this.clean();
    var files = name;
    if (!!bundleOpts) {
      this.config(bundleOpts);
      if (bundleOpts.files) files = bundleOpts.files;
    }
    this.load(files);
    var filename = name;
    if (!name.match(/\.js$/)) {
      filename = this.options.modPath + name + '.js';  // TODO: This is a poor detection for Modules
    }
    this.save(filename.replace(/\$/, this.options.modPath));

    // return the dep names for use in the exclusion param of future bundles
    var loadedDeps = [];
    this.dependencies.deps.forEach(function(dep) {
      loadedDeps.push(dep.name);
    });
    this.manifest[name] = loadedDeps;
    return loadedDeps;
  },
  log: function(level, message, obj) {
    this.errors.push({ level: level, message: message, obj:obj });
    if (this.options.logLevel >= level) console.log(message, obj);
  },
  logInfo: function(message, obj) {
    this.log(2, message, obj);
  },
  logError: function(message, obj) {
    this.log(1, message, obj);
  },
  getErrors: function() {
    return this.errors;
  },
  getBundleManifest: function() {
    return this.manifest;
  }
};

mixin(exports, {
  builder: function(options) {
    return new LoadBuilder(options);
  },
  Dependency: Dependency  // output to make testing possible
});
