var fs     = require('fs'),
    sys    = require('sys'),
    exec   = require('child_process').exec,
    jsp    = require('uglify-js').parser,
    jspro  = require("uglify-js").uglify,
    opts   = require('opts'),
    colors = require('colors'),
    path   = require('path'),
    using  = {};

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

function addFileToEnd(arr, item) {
  arr.forEach(function(element, index) {
    if (element.name == item.name) arr.splice(index, 1);
  });
  arr.push(item);
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
Dependency.generate = function(depSet) {
  var outputCode = [];
  depSet.script && depSet.script.forEach(function(script) {
    outputCode.push(jspro.gen_code(script.ast));
    outputCode.push('this.loadrunner.Script.loaded.push("' + script.name + '")');
  });
  if (depSet.module) {
    depSet.module.reverse();
    depSet.module.forEach(function(module) {
      outputCode.push(jspro.gen_code(module.ast));
    });
  }
  return outputCode.join(';');
};
Dependency.prototype.discoverDependencies = function(loadbuilder, depth) {
  var me = this;
  depth = depth || 0;
  if (excluded(this.name, loadbuilder) || (depth > 0 && !loadbuilder.options.follow)) {
    console.log('Ignoring file:'.yellow, indent(depth), this.filename);
    return;
  }
  depth++;
  try {
    this.ast = getSource(loadbuilder.options.docRoot + this.filename);
    if (!loadbuilder.dependencies[this.type]) loadbuilder.dependencies[this.type] = [];
    addFileToEnd(loadbuilder.dependencies[this.type], this);
    console.log('Loading file:'.green, indent(depth), this.filename);
  } catch (error) {
    // either file cannot be found, or cannot be parsed
    console.log('Failed to load file:'.red, indent(depth), this.filename);
    return;
  }

  function walk(node) {
    if (Array.isArray(node)) {
      if (isUsing(node)) {
        var deps = extractDeps(node[2]);

        deps.forEach(function(d) {
          for (var regex in using.matchers) {
            if (d.match(regex)) {
              var file = using.matchers[regex](d, loadbuilder.options.modPath);
              file.discoverDependencies(loadbuilder, depth+1);
              break;
            }
          }
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


function Script(filename) {
  this.name = filename;
  this.filename = filename;
  this.type = 'script';
}
Script.prototype = new Dependency;

function Module(name, modPath) {
  this.name = name;
  this.filename = modPath + this.getFilename();
  this.type = 'module';
}
Module.prototype = new Script;
Module.prototype.getFilename = function() {
  return this.name + '.js';
};

using.matchers = {};
using.matchers['\\.js$'] = function(path, modPath) {
  return new Script(path.replace(/^\$/, modPath + '/'));
};
using.matchers['^[a-zA-Z0-9_\\-\\/]+$'] = function(id, modPath) {
  return new Module(id, modPath);
};


function LoadBuilder(options) {
  this.dependencies = {  };
  this.options = {
    matchers: [],
    exclude: [],
    nomin: true,
    follow: true,
    docRoot: process.cwd(),
    distRoot: process.cwd() + '/dist',
    modPath: '/modules',
  };
  this.config(options);
}
LoadBuilder.prototype = {
  config: function(options) {
    mixin(this.options, options);
    this.options.docRoot = this.options.docRoot.replace(/\/$/,'') + '/';
    this.options.distRoot = this.options.distRoot.replace(/\/$/,'') + '/';
    this.options.modPath = this.options.modPath.replace(/^\//,'').replace(/\/$/,'') + '/';
    if (this.options.docRoot == this.options.distRoot) {
      console.log('docRoot and distRoot are the same'.red, ', so output files will overwrite sources.');
      console.log('Helpfully appending "dist" to the distRoot.');
      this.options.distRoot += 'dist/';
    }
    return this;
  },
  load: function(files, options) {
    var file, me=this;
    if (typeof(files)==="string") files=[files];
    files.forEach(function(d) {
      for (var regex in using.matchers) {
        if (d.match(regex)) {
          var file = using.matchers[regex](d, me.options.modPath);
          file.discoverDependencies(me);
          break;
        }
      }
    });
    return this;
  },
  combine: function() {
    var outputCode = [];
    this.code = Dependency.generate(this.dependencies);
    return this;
  },
  minify: function() {
    var bigSize = this.code.length;
    var smallSize = 0;
    var minifiedAST = jsp.parse(this.code);
    minifiedAST = jspro.ast_mangle(minifiedAST);
    minifiedAST = jspro.ast_squeeze(minifiedAST);
    this.code = jspro.gen_code(minifiedAST);
    smallSize = this.code.length;
    console.log(('Minified from ' + bigSize + ' to ' + smallSize + ' bytes').white);
    return this;
  },
  save: function(outputFilename) {
    var outputFile = this.options.distRoot + outputFilename;
    var outputCode = this.code;
    console.log('Output file to'.white, outputFile);
    mkdir(outputFile.replace(/[^\/]+$/, ''), function() {
      fs.writeFileSync(outputFile, outputCode);
    });
    return this;
  },
  bundle: function(name, bundleOpts) {
    this.options.exclude = [];
    this.dependencies = { };
    if (!!bundleOpts) this.config(bundleOpts);

    this.load(name);
    if (!name.match(/\.js$/)) {
      name = this.options.modPath + name + '.js';
    }
    this.combine().minify().save(name);

    // return the dep names for use in the exclusion param of future bundles
    var loadedDeps = [];
    for (var typename in this.dependencies) {
      this.dependencies[typename].forEach(function(dep) {
        loadedDeps.push(dep.name);
      });
    }
    return loadedDeps;
  }
};

mixin(exports, {
  builder: function(options) {
    return new LoadBuilder(options);
  }
});
