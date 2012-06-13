var parser = require('esprima'),
    File   = require('./file');

function match(fragment, tree) {
  // console.log(fragment, tree);
  var matches = [];
  if (fragment && tree && Object.keys(fragment).every(function(fragmentKey, i) {
    var item = fragment[fragmentKey],
        subMatches;

    if ((typeof tree[fragmentKey] == 'undefined') || (tree[fragmentKey] === null)) {
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
  var tree;
  if (source instanceof File) {
    tree = source.ast();
  } else if (typeof source == 'object') {
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