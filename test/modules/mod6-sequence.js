provide(function(exports) {
  using(['mod2_a', 'mod2_b'], function(a, b) {
    exports(b);
  });
  using('mod2_b', function(b) {

  });
});