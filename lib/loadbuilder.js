var fs     = require('fs'),
    jsp    = require('uglify-js').parser,
    jspro  = require("uglify-js").uglify,
    opts   = require('opts'),
    colors = require('colors'),
    _options,
    modulePath = '';

function mixin(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
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

function addToEnd(arr, item) {
  var index = arr.indexOf(item);
  if (index>=0) {
    arr.splice(index, 1);
  }
  arr.push(item);
}

var fileObj = function(name, type, filename) {
  this.name = name;
  this.type = type || '';
  this.ast = [];
  this.filename = filename;
};

var matchers = {};
matchers['\\.js$'] = function(filename, dependencies) {
  var file = new fileObj(filename, 'script', filename.replace(/^\$/, modulePath));
  discoverDependencies(file, dependencies);
};
matchers['^[a-zA-Z0-9_\\-\\/]+$'] = function(id, dependencies) {
  var file = new fileObj(id, 'module', modulePath + id + '.js');
  discoverDependencies(file, dependencies);
};

function discoverDependencies(file, dependencies) {
  dependencies = dependencies || { scripts: [], modules: [], warnings: [] };
  if (_options.exclude.indexOf(file.name) != -1) {
    console.log('Ignoring file:'.yellow, file.filename);
    return dependencies;
  }
  try {
    var ast = getSource(file.filename);
    file.ast = ast;
    addToEnd(dependencies[file.type+'s'], file);
    console.log('Loading file:'.green, file.filename);
  } catch (error) {
    dependencies.warnings.push(file.filename);
    // either file cannot be found, or cannot be parsed
    console.log('Failed to load file:'.red, file.filename);
    return dependencies;
  }

  function walk(node) {
    if (Array.isArray(node)) {
      if (isUsing(node)) {
        var deps = extractDeps(node[2]);

        deps.forEach(function(d) {
          for (var regex in matchers) {
            if (d.match(regex)) {
              matchers[regex](d, dependencies);
              break;
            }
          }
        });
      } else if (isProvide(node)) {
        if (node[2][0][0] === 'function') {
          node[2].unshift(['string', file.name]);
        }
      }

      node.forEach(walk);
    }
  }

  walk(ast);

  return dependencies;
}

mixin(exports, {
  code: '',
  dependencies: { scripts: [], modules: [], warnings: [] },
  config: function(options) {
    // clear out current settings
    _options = {
      path: '',
      matchers: [],
      include: [],
      exclude: [],
      nomin: true,
      follow: false
    };
    mixin(_options, options);

    modulePath = _options.path || process.cwd();
    modulePath = modulePath.replace(/\$\//,'') + '/';

    return module.exports;
  },
  load: function(files, options) {
    var file, me=this;
    if (!_options) this.config(options);
    if (typeof(files)==="string") files=[files];
    files.forEach(function(filename) {
      file = new fileObj(filename, 'module', modulePath + filename + '.js');
      me.dependencies = discoverDependencies(file, me.dependencies);
    });
    return module.exports;
  },
  combine: function() {
    var outputCode = [];
    this.dependencies.scripts.forEach(function(script) {
      outputCode.push(jspro.gen_code(script.ast));
      outputCode.push('this.loadrunner.Script.loaded.push("' + script.name + '")');
    });
    this.dependencies.modules.reverse();
    this.dependencies.modules.forEach(function(module) {
      outputCode.push(jspro.gen_code(module.ast));
    });
    this.code = outputCode.join(';');
    return module.exports;
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

    return module.exports;
  },
  save: function(outputFilename) {

    console.log('Output file to'.white, outputFilename);
    fs.writeFileSync(outputFilename, this.code);

    return module.exports;
  },
  bundle: function(name, bundleOpts) {
    this.config(options);
    module.exports.load(options.include, {
      exclude: options.exclude,
      path: options.path,
      nomin: options.nomin,
    }).combine().minify().save(name);

    return module.exports;
  }
});