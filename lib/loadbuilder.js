var fs     = require('fs'),
    sys    = require('sys'),
    exec   = require('child_process').exec,
    jsp    = require('uglify-js').parser,
    jspro  = require("uglify-js").uglify,
    opts   = require('opts'),
    colors = require('colors'),
    path   = require('path'),
    using  = {};

/*
 TODO:
 - output inline bundle script
 - switch logging to optional js-compatible output
 - hinting
 - try coffescript for the loadbuilder shell

*/

function mixin(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function mkdir(dir, f) {
  exec("mkdir -p " + dir, f);
}

function indent(depth) {
  return Array(depth).join(' ');
}

function extractDeps(argList) {
  return argList.map(function(item) {
    if (item[0] == 'string') {
      return item[1];
    }
  }).filter(  function(item) {
    return !(typeof item == 'undefined' || item == null);
  });
}

function isUsing(node) {
  return node[0] == 'call' && node[1][1] == 'using';
}

function isProvide(node) {
  return node[0] == 'call' && node[1][1] == 'provide';
}

function getSource(file) {
  var source = fs.readFileSync(file, 'utf-8');
  return jsp.parse(source);
}

function excluded(item, loadbuilder) {
  var excluded = false;
  loadbuilder.options.exclude.forEach(function(excl) {
    if (typeof(excl)=='string' && excl.name==item) {
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
  this.ast = [];
}
Dependency.prototype.discoverDependencies = function(loadbuilder, depth) {
  var me = this;
  depth = depth+1 || 0;
  if (excluded(this.name, loadbuilder)) {
    loadbuilder.log(2, 'Ignoring file:', [ this.name, this.filename ]);
    return;
  }
  try {
    this.ast = getSource(loadbuilder.options.docRoot + this.filename);
    this.addToDependencies(loadbuilder.dependencies);
    loadbuilder.log(2, 'Loading file:', [ this.name, this.filename ]);
  } catch (error) {
    // either file cannot be found, or cannot be parsed
    loadbuilder.log(1, 'Failed to load file:', [ this.name, this.filename ]);
    return;
  }

  function walk(node) {
    if (Array.isArray(node)) {
      if (isUsing(node)) {
        var deps = extractDeps(node[2]);
        deps.forEach(function(d) {
          loadbuilder._loadFile(d, depth+1);
        });
      } else if (isProvide(node)) {
        if (node[2][0][0] === 'function') {
          node[2].unshift(['string', me.name]);
        }
      }

      node.forEach(walk);
    }
  }

  walk(this.ast);

  return;
};


function Script(name, modPath) {
  this.name = name;
  if (name) this.filename = this.getFilename(name, modPath);
  this.type = 'script';
}
Script.prototype = new Dependency;
Script.prototype.generateCode = function() {
  return jspro.gen_code(this.ast) + 'loadrunner.Script.loaded.push("' + this.name + '")';
};
Script.prototype.getFilename = function(name, modPath) {
  return name.replace(/^\$/, modPath);
};
Script.prototype.addToDependencies = function(dependencies) {
  var script = this;
  // remove from dependencies if existing
  dependencies.forEach(function(element, index) {
    if (element.name == script.name) dependencies.splice(index, 1);
  });
  // add to top
  dependencies.unshift(this);
}

function Module(name, modPath) {
  this.name = name;
  this.filename = modPath + this.getFilename();
  this.type = 'module';
}
Module.prototype = new Script;
Module.prototype.generateCode = function() {
  return jspro.gen_code(this.ast);
};
Module.prototype.getFilename = function() {
  return this.name + '.js';
};
Module.prototype.addToDependencies = function(dependencies) {
  var script = this;
  // remove from dependencies if existing
  dependencies.forEach(function(element, index) {
    if (element.name == script.name) dependencies.splice(index, 1);
  });
  // add above first module
  for (var i=0; (l=dependencies[i]); i++ ) {
    if (dependencies[i].type=="module") {
      dependencies.splice(i, 0, this);
      return;
    }
  }
  // if not returned already,
  dependencies.push(this);
}


// note that these methods are a little different to LoadRunner: modPath is passed through
using.matchers = {};
using.matchers['\\.js$'] = function(path, modPath) {
  return new Script(path, modPath);
};
using.matchers['^[a-zA-Z0-9_\\-\\/]+$'] = function(id, modPath) {
  return new Module(id, modPath);
};


function LoadBuilder(options) {
  this.options = {
    exclude: [],
    nomin: true,
    docRoot: process.cwd(),
    distRoot: process.cwd() + '/dist',
    modPath: '/modules',
    logLevel: 1  // log levels: 0:none, 1:error, 2:info
  };
  this.manifest = {};
  this._clean();
  this.config(options);
}
LoadBuilder.prototype = {
  _clean: function() {
    this.options.exclude = [];
    this.dependencies = [];
    this.code = '';
    this.errors = [];
  },
  config: function(options) {
    mixin(this.options, options);
    this.options.docRoot = this.options.docRoot.replace(/\/$/,'') + '/';
    this.options.distRoot = this.options.distRoot.replace(/\/$/,'') + '/';
    this.options.modPath = this.options.modPath.replace(/^\//,'').replace(/\/$/,'') + '/';
    if (this.options.docRoot == this.options.distRoot) {
      this.log(1, 'docRoot and distRoot are the same, so output files will overwrite sources.', []);
      this.log(2, 'Helpfully appending "dist" to the distRoot.', []);
      this.options.distRoot += 'dist/';
    }
    return this;
  },
  _loadFile: function(name, depth) {
    for (var regex in using.matchers) {
      if (name.match(regex)) {
        var file = using.matchers[regex](name, this.options.modPath);
        file.discoverDependencies(this, depth);
        return;
      }
    }
    this.log(1, 'Unrecognised dependency', [ name ]);
  },
  load: function(files, options) {
    var file, loadbuilder=this;
    if (typeof(files)==="string") files=[files];
    files.forEach(function(d) {
      loadbuilder._loadFile(d, 0);
    });
    return this;
  },
  _generate: function() {
    var outputCode = [];
    this.dependencies.forEach(function(item) {
      outputCode.push(item.generateCode());
    });
    return outputCode.join(';');
  },
  minify: function() {
    this.code = this._generate();
    var bigSize = this.code.length;
    var smallSize = 0;
    var minifiedAST = jsp.parse(this.code);
    minifiedAST = jspro.ast_mangle(minifiedAST);
    minifiedAST = jspro.ast_squeeze(minifiedAST);
    this.code = jspro.gen_code(minifiedAST);
    smallSize = this.code.length;
    this.log(2, 'Minified from ' + bigSize + ' to ' + smallSize + ' bytes', []);
    return this;
  },
  save: function(outputFilename) {
    if (!this.code) this._generate();
    var outputFile = this.options.distRoot + outputFilename;
    var outputCode = this.code;
    this.log(2, 'Output file', [ outputFile ]);
    mkdir(outputFile.replace(/[^\/]+$/, ''), function() {
      fs.writeFileSync(outputFile, outputCode);
    });
    return this;
  },
  bundle: function(name, bundleOpts) {
    this._clean();
    if (!!bundleOpts) this.config(bundleOpts);

    this.load(name);
    var filename = name;
    if (!name.match(/\.js$/)) {
      filename = this.options.modPath + name + '.js';
    }
    this.minify().save(filename);

    // return the dep names for use in the exclusion param of future bundles
    var loadedDeps = [];
    this.dependencies.forEach(function(dep) {
      loadedDeps.push(dep.name);
    });
    this.manifest[name] = loadedDeps;
    return loadedDeps;
  },
  log: function(level, message, obj) {
    this.errors.push({ level: level, message: message, obj:obj });
    if (this.options.logLevel >= level) console.log(message, obj);
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
