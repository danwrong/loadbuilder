var parser = require('uglify-js').parser;

function match(fragment, tree) {
  var matches = [];

  if ((fragment.length <= tree.length) && fragment.every(function(item, i) {
    var subMatches;

    if (item === null) {
      matches.push(tree[i]);
      return true;
    }

    if (item === tree[i]) {
      return true;
    }

    if (Array.isArray(tree[i]) && Array.isArray(item) && (subMatches = match(item, tree[i]))) {
      matches = matches.concat(subMatches);
      return true;
    }

    return false;
  })) {
    return matches;
  }

  return null;
}

function walk(matcher, tree, parent, index) {
  var matches = [], m;

  if (Array.isArray(tree)) {
    if (m = match(matcher, tree)) {
      matches.push({
        parent: parent || null,
        index: index || 0,
        values: m
      });
    }

    tree.forEach(function(node, i) {
      matches = matches.concat(walk(matcher, node, tree, i));
    });
  }
  return matches;
}

function analyze(matcher, source) {
  // treeish can be source string, file object (from asset.js) or ast
  if (source.mtime && !source.ast) {
    source.ast = parser.parse(source.source);
  }
  var tree;
  if (source.ast) {
    tree = source.ast;
  } else if (Array.isArray(source)) {
    tree = source;
  } else {
    tree = parser.parse(source);
  }
  return walk(matcher, tree);
}

module.exports = {
  match: match,
  walk: walk,
  analyze: analyze
};