var parser = require('esprima');

function match(fragment, tree) {
  var matches = [];
  if (Object.keys(fragment).every(function(fragmentKey, i) {
    var item = fragment[fragmentKey],
        subMatches;

    if (!tree[fragmentKey]) {
      return false;
    }

    if (item === null) {
      matches.push(tree[fragmentKey]);
      return true;
    }

    if (item === tree[fragmentKey]) {
      return true;
    }

    if (typeof tree[fragmentKey] === 'object' && typeof item === 'object' && (subMatches = match(item, tree[fragmentKey]))) {
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
  if (m = match(matcher, tree)) {
    matches.push({
      parent: parent || null,
      index: index || 0,
      values: m
    });
  }
  if (typeof tree == 'object') {
    Object.keys(tree).forEach(function(node, i) {
      if (tree[node]===null) return;
      matches = matches.concat(walk(matcher, tree[node], tree, i));
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