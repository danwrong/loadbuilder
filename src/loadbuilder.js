var fs     = require('fs'),
    sys    = require('sys'),
    exec   = require('child_process').exec,
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

function mkdir(dir, f) {
  exec("mkdir -p " + dir, f);
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
      console.log('excluded!', excl, item)
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
}
Dependency.prototype.fetchSource = function() {
  this.source = fs.readFileSync(this.lb.options.docRoot + this.filename, 'utf8');
};
Dependency.prototype.parseSource = function() {
  this.ast = jsp.parse(this.source);
};
Dependency.prototype.getLicense = function() {
  var text = this.source.replace(/\n/g, '\\n');
  var matches = text.match(/^(\/\*\!.*?\*\/)/);
  if (matches) return matches[1].replace(/\\n/g, '\n');
  return '';
};
Dependency.prototype.hint = function(opts) {
  jshint(this.source, opts);
  if (jshint.errors.length) {
    this.lb.log(2, 'JSHint ' + this.name, jshint.errors);
  }
};
Dependency.prototype.discoverDependencies = function(depth) {
  var me = this;
  depth = depth+1 || 0;
  if (excluded(this.name, this.lb)) {
    this.lb.log(2, 'Ignoring file:', [ this.name, this.filename ]);
    return;
  }
  try {
    this.fetchSource();
    this.lb.log(2, 'Loading file:', [ this.name, this.filename ]);
  } catch (error) {
    this.lb.log(1, 'Failed to load file:', [ this.name, this.filename ]);
    return;
  }
  try {
    this.parseSource();
    this.addToDependencies(this.lb.dependencies);
  } catch (error) {
    this.lb.log(1, 'Failed to parse file:', [ this.name, this.filename ]);
    this.hint();
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

  walk(this.ast);

  return;
};
Dependency.prototype.addToDependencies = function(dependencies) {
  var script = this;
  // remove from dependencies if existing
  dependencies.forEach(function(element, index) {
    if (element.name == script.name) dependencies.splice(index, 1);
  });
  // add above first script
  dependencies.unshift(this);
}




function Script(name, loadbuilder) {
  this.name = name;
  this.lb = loadbuilder;
  if (name) this.filename = this.getFilename(name, this.lb.options.modPath);
  this.type = 'script';
}
Script.matcher = /\.js$/;
Script.prototype = new Dependency;
Script.prototype.getCode = function(minify) {
  var code = '';
  if (minify) {
    this.ast = jspro.ast_mangle(this.ast);
    this.ast = jspro.ast_squeeze(this.ast);
  }
  code = jspro.gen_code(this.ast);
  return this.getLicense() + code;
};
Script.prototype.generateCode = function(minify) {
  return this.getCode(minify) + ';loadrunner.Script.loaded.push("' + this.name + '")';
};
Script.prototype.getFilename = function(name, modPath) {
  return name.replace(/^\$/, this.lb.options.modPath);
};

function Module(name, loadbuilder) {
  this.name = name;
  this.lb = loadbuilder;
  this.filename = this.lb.options.modPath + this.getFilename();
  this.type = 'module';
}
Module.matcher = /^[a-zA-Z0-9_\-\/]+$/;
Module.prototype = new Script;
Module.prototype.generateCode = function(minify) {
  return this.getCode(minify);
};
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
    for (var index in this.options.matchers) {
      if (name.match(this.options.matchers[index].matcher)) {
        var file = new this.options.matchers[index](name, this);
        file.discoverDependencies(depth);
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
  hint: function(opts){
    this.dependencies.forEach(function(d) {
      d.hint(opts);
    });
  },
  _generate: function() {
    var outputCode = [];
    var minify = !this.options.nomin;
    this.dependencies.forEach(function(item) {
      outputCode.push(item.generateCode(minify));
    });
    return outputCode.join(';');
  },
  namespace: function() {
    this.code = this.options.namespace + "(function(using, provide, loadrunner, define) {" +
                this.code + '});';
  },
  addLoadrunner: function() {
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

    this.code = lr + this.code;
  },
  save: function(outputFilename) {
    if (!this.code) this.code = this._generate();

    if (typeof this.options.namespace == 'string' && this.options.namespace.length > 0) {
      this.namespace();
    }

    if (typeof this.options.standAlone == 'string' && this.options.standAlone.length > 0) {
      this.addLoadrunner();
    }

    var outputFile = this.options.distRoot + outputFilename;
    var outputCode = this.code;

    if (this.options.distRoot == 'STDOUT/') {
      console.log(outputCode);
    } else {
      this.log(2, 'Output file', [ outputFile ]);
      mkdir(outputFile.replace(/[^\/]+$/, ''), function() {
        fs.writeFileSync(outputFile, outputCode);
      });
    }
    return this;
  },
  bundle: function(name, bundleOpts) {
    this._clean();
    if (!!bundleOpts) this.config(bundleOpts);

    this.load(name);
    var filename = name;
    if (!name.match(/\.js$/)) {
      filename = this.options.modPath + name + '.js';  // TODO: This is a poor detection for Modules
    }
    this.save(filename.replace(/\$/, this.options.modPath));

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
