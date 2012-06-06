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

var memoizedTrees = {};
var memoDate = +new Date();
function analyze(matcher, sourceOrTree) {
  var tree = sourceOrTree;
  var now = +new Date();
  if (now - memoDate > 10 * 60 * 1000) {
    // just empty the cache after ten minutes to avoid massive memory pain
    memoizedTrees = {};
    memoDate = now;
  }
  if (!Array.isArray(tree)) {
    if (memoizedTrees[tree]) {
      tree = memoizedTrees[tree];
    } else {
      tree = memoizedTrees[tree] = parser.parse(tree);
    }
  }
  return walk(matcher, tree);
}

module.exports = {
  match: match,
  walk: walk,
  analyze: analyze
};