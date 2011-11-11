var analyzer = require('loadbuilder/analyzer'),
    assert   = require('assert');

var tree = [1, 2, [3], [4, [5]], [5]], match, matches;

module.exports = {
  testMatchShouldReturnNullIfNoMatches: function() {
    match = analyzer.match(['not', 'here', 3556], tree);
    assert.isNull(match);
  },

  testMatchShouldReturnArrayIfMatches: function() {
    match = analyzer.match([1, 2], tree);
    assert.eql(match, []);

    match = analyzer.match([1, 2, [3]], tree);
    assert.eql(match, []);

    match = analyzer.match(tree, tree);
    assert.eql(match, []);
  },

  testMatchShouldReturnMatchedWildcardsInArray: function() {

    match = analyzer.match([null, 2], tree);
    assert.eql(match, [1]);

    match = analyzer.match([1, 2, [null]], tree);
    assert.eql(match, [3]);

    match = analyzer.match([null, 2, [null]], tree);
    assert.eql(match, [1, 3]);
  },

  testWalkShouldReturnArrayOfMatches: function() {
    matches = analyzer.walk([4], tree);
    assert.eql(matches, [
      { parent: tree, index: 3, values: [] }
    ]);

    matches = analyzer.walk([1, null], tree);
    assert.eql(matches, [
      { parent: null, index: 0, values: [2] }
    ]);

    matches = analyzer.walk([4, [null]], tree);
    assert.eql(matches, [
      { parent: tree, index: 3, values: [5] }
    ]);

    matches = analyzer.walk([5], tree);
    assert.eql(matches, [
      { parent: tree[3], index: 1, values: [] },
      { parent: tree, index: 4, values: [] }
    ]);
  },

  testAnalyzeShouldWalkJSSource: function() {
    var src = "function pow() { var thing = require('blah'); }";

    matches = analyzer.analyze(
                [ 'call',
                  [ 'name', 'require' ],
                  [
                    ['string', null]
                  ]
                ], src);

    assert.eql(matches[0].values, ['blah']);
  }
}
