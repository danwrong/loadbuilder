/*
  This is a more complex use-case for dependencies.
  We'll try to load in a complicated tree.
*/
provide(function(exports) {

  using('mod3_a', function(a) {  // A depends on B
    using('mod3_c', function(c) { // C depends on A
      exports(c);
    });
  });
  // -> B, A, C

  using('mod3_a', 'mod3_c', function(a, c) {  // A depends on B // C depends on A
    exports(c);
  });
  // -> B, A, C

  using('mod3_a', function(a) {  // A depends on B
    using('mod3_c', function(c) { // C depends on A
      using('mod3_a', function(a2) {  // A depends on B
        exports(a2);
      });
    });
    using('mod3_c', function(c) { // C depends on A
      exports(c);
    });
  });
  // -> B, A, C

});