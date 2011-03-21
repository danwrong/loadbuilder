var fs     = require('fs'),
    jsp    = require('uglifyjs').parser,
    smoosh = require('smoosh');

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

function getSource(file) {
  var source = fs.readFileSync(file, 'utf-8');
  return jsp.parse(source);
}

function discoverDependencies(file, dependencies) {
  dependencies = dependencies || { scripts: [], modules: [], warnings: [] };
  var ast = getSource(file);

  function walk(node) {
    if (Array.isArray(node)) {
      if (isUsing(node)) {
        var deps = extractDeps(node[2]);

        deps.forEach(function(d) {
          if (d.match(/\.js$/)) {
            if (dependencies.scripts.indexOf(d) == -1) {
              dependencies.scripts.push(d);
            }
            discoverDependencies('js/' + d, dependencies);
          } else {
            if (dependencies.modules.indexOf(d) == -1) {
              dependencies.modules.push(d);
            }
            discoverDependencies('js/' + d + '.js', dependencies);
          }
        });
      }

      node.forEach(walk);
    }
  }

  walk(ast);

  return dependencies;
}

mixin(exports, {
  combine: function(file, options) {
    options = options || {};
    var dependencies = discoverDependencies(file);
    console.log(dependencies);
  }
});