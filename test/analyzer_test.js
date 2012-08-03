var analyzer = require('loadbuilder/analyzer'),
    assert   = require('assert');

var tree = {
      a: 1,
      b: 2,
      c: [
        3,
        4,
        {
          d: 7
        }
      ],
      e: {
        f: 8
      },
      f: 9
    },
    match, matches;

module.exports = {
  testMatchShouldReturnNullIfNoMatches: function() {
    match = analyzer.match({ not: 'here' }, tree);
    assert.isNull(match);
  },

  testMatchShouldReturnArrayIfMatches: function() {
    match = analyzer.match({ a: 1, b: 2 }, tree);
    assert.eql(match, []);

    match = analyzer.match({ a: 1, b: 2, c: [ 3 ] }, tree);
    assert.eql(match, []);

    match = analyzer.match(tree, tree);
    assert.eql(match, []);
  },

  testMatchShouldReturnMatchedWildcardsInArray: function() {

    match = analyzer.match({ a: null }, tree);
    assert.eql(match, [1]);

    match = analyzer.match({
        a: 1,
        b: 2,
        c: null
      }, tree);
    assert.eql(match, [[3,4,{"d":7}]]);

    match = analyzer.match({ a: null, b: null }, tree);
    assert.eql(match, [1, 2]);
  },

  testWalkShouldReturnArrayOfMatches: function() {
    matches = analyzer.walk({ f: 8 }, tree);
    assert.eql(matches, [
      { parent: tree, index: 3, values: [] }
    ]);

    matches = analyzer.walk({ a: 1, b: null }, tree);
    assert.eql(matches, [
      { parent: null, index: 0, values: [2] }
    ]);

    matches = analyzer.walk({ b: 2, c: [null] }, tree);
    assert.eql(matches, [
      { parent: null, index: 0, values: [3] }
    ]);

    matches = analyzer.walk({ f: null }, tree);
    assert.eql(matches, [
      { parent: null, index: 0, values: [9] },
      { parent: tree, index: 3, values: [8] }
    ]);
  },

  testAnalyzeShouldWalkJSSource: function() {
    var src = "function pow() { var thing = require('blah'); }";

    matches = analyzer.analyze({
        "type": "CallExpression",
        "callee": {
            "type": "Identifier",
            "name": "require"
        },
        "arguments": [
            {
                "type": "Literal",
                "value": null
            }
        ]
    }, src);

    assert.eql(matches[0].values, ['blah']);
  }
}
